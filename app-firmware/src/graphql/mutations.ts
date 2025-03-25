/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createDrink = /* GraphQL */ `mutation CreateDrink(
  $input: CreateDrinkInput!
  $condition: ModelDrinkConditionInput
) {
  createDrink(input: $input, condition: $condition) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateDrinkMutationVariables,
  APITypes.CreateDrinkMutation
>;
export const updateDrink = /* GraphQL */ `mutation UpdateDrink(
  $input: UpdateDrinkInput!
  $condition: ModelDrinkConditionInput
) {
  updateDrink(input: $input, condition: $condition) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateDrinkMutationVariables,
  APITypes.UpdateDrinkMutation
>;
export const deleteDrink = /* GraphQL */ `mutation DeleteDrink(
  $input: DeleteDrinkInput!
  $condition: ModelDrinkConditionInput
) {
  deleteDrink(input: $input, condition: $condition) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteDrinkMutationVariables,
  APITypes.DeleteDrinkMutation
>;
export const createFavorite = /* GraphQL */ `mutation CreateFavorite(
  $input: CreateFavoriteInput!
  $condition: ModelFavoriteConditionInput
) {
  createFavorite(input: $input, condition: $condition) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateFavoriteMutationVariables,
  APITypes.CreateFavoriteMutation
>;
export const updateFavorite = /* GraphQL */ `mutation UpdateFavorite(
  $input: UpdateFavoriteInput!
  $condition: ModelFavoriteConditionInput
) {
  updateFavorite(input: $input, condition: $condition) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateFavoriteMutationVariables,
  APITypes.UpdateFavoriteMutation
>;
export const deleteFavorite = /* GraphQL */ `mutation DeleteFavorite(
  $input: DeleteFavoriteInput!
  $condition: ModelFavoriteConditionInput
) {
  deleteFavorite(input: $input, condition: $condition) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteFavoriteMutationVariables,
  APITypes.DeleteFavoriteMutation
>;
