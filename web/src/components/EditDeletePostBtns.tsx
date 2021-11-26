import { EditIcon, DeleteIcon } from "@chakra-ui/icons";
import { Box, Link } from "@chakra-ui/layout";
import { IconButton } from "@chakra-ui/react";
import React from "react";
import NextLink from "next/link";
import { useDeletePostMutation, useMeQuery } from "../generated/graphql";

interface EditDeletePostBtnsProps {
  id: number;
  postCreatorId: number;
}

export const EditDeletePostBtns: React.FC<EditDeletePostBtnsProps> = ({
  id,
  postCreatorId
}) => {
  const [, deletePost] = useDeletePostMutation();
  const [{ data: meData }] = useMeQuery();
  if (meData?.me?.id !== postCreatorId) {
      return null;
  }
  return (
    <Box>
      <NextLink href="/post/edit/[id]" as={`/post/edit/${id}`}>
        <IconButton
          as={Link}
          _hover={{ bgColor: "#38B2AC" }}
          icon={<EditIcon />}
          aria-label="edit-post"
        ></IconButton>
      </NextLink>
      <IconButton
        _hover={{ bgColor: "red" }}
        icon={<DeleteIcon />}
        aria-label="delete-post"
        onClick={() => {
          deletePost({ id });
        }}
      ></IconButton>
    </Box>
  );
};
