import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";
import { Upvote } from "../entities/Upvote";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpvote = value !== -1;
    const insertValue = isUpvote ? 1 : -1;
    const { userId } = req.session;

    const upvote = await Upvote.findOne({ where: { postId, userId } });

    //Changing vote on post
    if (upvote && upvote.value !== insertValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        update upvote
        set value = $1
        where "postId" = $2 and "userId" = $3
        `,
          [insertValue, postId, userId]
        );

        await tm.query(
          `
        update post
        set points = points + $1
        where id = $2
        `,
          [2 * insertValue, postId]
        );
      });
    } else if (!upvote) {
      //Not voted on post before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `insert into upvote ("userId", "postId", value)
        values ($1, $2, $3)        
        `,
          [userId, postId, insertValue]
        );

        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2
        `,
          [insertValue, postId]
        );
      });
    }

    return true;
  }

  @Query(() => PaginatedPosts) //GraphQL type
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const postDisplayLimit = Math.min(50, limit);
    const paginateFetchLimit = postDisplayLimit + 1; // +1 for checking if there are more posts available, only return realLimit number

    const replacements: any[] = [paginateFetchLimit];

    if (req.session.userId) {
      replacements.push(req.session.userId);
    }

    let cursorIdx = 3;

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
      cursorIdx = replacements.length;
    }

    const posts = await getConnection().query(
      `
      select p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
        ) "postCreator",
        ${
          req.session.userId
            ? '(select value from upvote where "userId" = $2 and "postId" = p.id) "voteStatus"'
            : 'null as "voteStatus"'
        }
      from post p
      inner join public.user u on u.id = p."postCreatorId"
      ${cursor ? `where p."createdAt" < $${cursorIdx}` : ""}
      order by p."createdAt" DESC
      limit $1
      `,
      replacements
    );

    // console.log("posts: ", posts);
    console.log(replacements);

    return {
      posts: posts.slice(0, postDisplayLimit),
      hasMore: posts.length === paginateFetchLimit,
    };
  }

  @Query(() => Post, { nullable: true }) //GraphQL type or nullable
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    // type-graphql type

    return Post.findOne(id, { relations: ["postCreator"] });
  }

  @Mutation(() => Post) //GraphQL type
  @UseMiddleware(isAuth) // check auth before running mutation
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    // type-graphql type
    return Post.create({
      ...input,
      postCreatorId: req.session.userId,
    }).save();
  }

  @Mutation(() => Post, { nullable: true }) //GraphQL type
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id") id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() {req}: MyContext
  ): Promise<Post | null> {
    // type-graphql type

    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    await Post.update({ id }, { title, text });
    return post;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    //Not-Cascaded method: 
    // const post = await Post.findOne(id);
    // if (!post) {
    //   return false
    // }
    // if (post.postCreatorId !== req.session.userId) {
    //   throw new Error("Not authorized")
    // }
    // await Upvote.delete({postId: id});
    // await Post.delete({ id });

    //Cascade method, requires attribute in entity definition
    await Post.delete({id, postCreatorId: req.session.userId})
    return true;
  }
}
