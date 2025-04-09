/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getLikedDrink = /* GraphQL */ `query GetLikedDrink($id: ID!) {
  getLikedDrink(id: $id) {
    id
    userID
    drinkID
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLikedDrinkQueryVariables,
  APITypes.GetLikedDrinkQuery
>;
export const listLikedDrinks = /* GraphQL */ `query ListLikedDrinks(
  $filter: ModelLikedDrinkFilterInput
  $limit: Int
  $nextToken: String
) {
  listLikedDrinks(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      userID
      drinkID
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListLikedDrinksQueryVariables,
  APITypes.ListLikedDrinksQuery
>;
