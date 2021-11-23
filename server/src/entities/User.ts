import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Post } from "./Post";
import { Upvote } from "./Upvote";

@ObjectType()
@Entity()
export class User extends BaseEntity{
    @Field()
    @PrimaryGeneratedColumn()
    id!: number;

    @Field()
    @Column({unique: true})
    username!: string;

    @Field()
    @Column({unique: true})
    email!: string;

    // @Field() // not exposed via API
    @Column()
    password!: string;

    @OneToMany(() => Post, (post: Post) => post.postCreator)
    posts: Post[];

    @OneToMany(() => Upvote, (upvote: Upvote) => upvote.user)
    upvotes: Upvote[];

    @Field(() => String)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => String)
    @UpdateDateColumn()
    updatedAt: Date;
}