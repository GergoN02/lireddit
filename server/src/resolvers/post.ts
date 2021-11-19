import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@Resolver(Post)
export class PostResolver {

    @FieldResolver(() => String)
    textSnippet(
      @Root() root: Post
    ) {
      return root.text.slice(0, 50);
    }




  @Query(() => [Post]) //GraphQL type
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string
  ): Promise<Post[]> {
    const realLimit = Math.min(50, limit);

    const postQuery = getConnection()
      .getRepository(Post)
      .createQueryBuilder("p")
      .orderBy('"createdAt"', "DESC")
      .take(realLimit);

    if (cursor) {
      postQuery.where('"createdAt" < :cursor', {
        cursor: new Date(parseInt(cursor)),
      });
    }

    return postQuery.getMany();
  }

  @Query(() => Post, { nullable: true }) //GraphQL type or nullable
  post(@Arg("id") id: number): Promise<Post | undefined> {
    // type-graphql type

    return Post.findOne(id);
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
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    // type-graphql type

    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      (post.title = title), await Post.update({ id }, { title });
    }
    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id", () => Int) id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }
}
