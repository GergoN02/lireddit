import argon2 from "argon2";
import { MyContext } from "src/types";
import { validateRegister } from "../utils/validRegistration";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../consts";
import { User } from "../entities/User";
import { UsernamePasswordInput } from "../utils/UsernamePasswordInput";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {

  
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() {req}: MyContext){
    //if current user with current email logged in, email can be displayed
    if(req.session.userId === user.id){
      return user.email;
    }
    //if current user wants to see other users email
    return "";
  }




  @Query(() => User, { nullable: true })
    me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    return User.findOne( req.session.userId );
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() {redis, req}: MyContext
  ): Promise<UserResponse>{
    if (newPassword.length <= 3) {
      return {errors: [
          {
            field: "newPassword",
            message: "Lenght must be greater than 3",
          },
        ] };
    }

    const key = FORGET_PASSWORD_PREFIX + token

    const userId = await redis.get(key)
    if (!userId) {
      return {errors: [
        {
          field: "token",
          message: "token expired",
        },
      ] };
    }

    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);
    if(!user){
      return {errors: [
        {
          field: "token",
          message: "user no longer exists",
        },
      ] };
    }

    await User.update({id : userIdNum}, {password: await argon2.hash(newPassword)});

    await redis.del(key);

    //Log-in user after pass change
    req.session.userId = user.id;
    
    return {user};
  }
        

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({email});
    if (!user) {
      //email not in database
      return true;
    }

    const token = v4();

    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    );

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">Reset Password</a>`
    );

    return true;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);

    if (errors) {
      return { errors };
    }

    const hashedPass = await argon2.hash(options.password);

    let user;
    try {
      // User.create({
      //   username: options.username,
      //   password: hashedPass,
      //   email: options.email,
      // }).save();

      const result = await getConnection()
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        username: options.username,
        password: hashedPass,
        email: options.email,
      })
      .returning('*')
      .execute();

      user = result.raw[0];

    } catch (err) {
      if (err.code === "23505") {
        //duplicate username error
        return {
          errors: [
            {
              field: "username",
              message: "Username already taken",
            },
          ],
        };
      }
    }
    // store userId session
    // sets cookie for user and keeps logged in
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: {email: usernameOrEmail} }
        : { where: {username: usernameOrEmail} }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Username does not exist",
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Incorrect password",
          },
        ],
      };
    }
    // store userId session
    // sets cookie for user and keeps logged in
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }
}
