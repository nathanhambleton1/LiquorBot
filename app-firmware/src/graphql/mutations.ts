/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createLikedDrink = /* GraphQL */ `mutation CreateLikedDrink(
  $input: CreateLikedDrinkInput!
  $condition: ModelLikedDrinkConditionInput
) {
  createLikedDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateLikedDrinkMutationVariables,
  APITypes.CreateLikedDrinkMutation
>;
export const updateLikedDrink = /* GraphQL */ `mutation UpdateLikedDrink(
  $input: UpdateLikedDrinkInput!
  $condition: ModelLikedDrinkConditionInput
) {
  updateLikedDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateLikedDrinkMutationVariables,
  APITypes.UpdateLikedDrinkMutation
>;
export const deleteLikedDrink = /* GraphQL */ `mutation DeleteLikedDrink(
  $input: DeleteLikedDrinkInput!
  $condition: ModelLikedDrinkConditionInput
) {
  deleteLikedDrink(input: $input, condition: $condition) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteLikedDrinkMutationVariables,
  APITypes.DeleteLikedDrinkMutation
>;
