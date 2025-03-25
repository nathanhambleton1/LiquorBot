/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getDrink = /* GraphQL */ `query GetDrink($id: ID!) {
  getDrink(id: $id) {
    id
    name
    category
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetDrinkQueryVariables, APITypes.GetDrinkQuery>;
export const listDrinks = /* GraphQL */ `query ListDrinks(
  $filter: ModelDrinkFilterInput
  $limit: Int
  $nextToken: String
) {
  listDrinks(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      category
      description
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListDrinksQueryVariables,
  APITypes.ListDrinksQuery
>;
export const getFavorite = /* GraphQL */ `query GetFavorite($id: ID!) {
  getFavorite(id: $id) {
    id
    userSub
    drinkID
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetFavoriteQueryVariables,
  APITypes.GetFavoriteQuery
>;
export const listFavorites = /* GraphQL */ `query ListFavorites(
  $filter: ModelFavoriteFilterInput
  $limit: Int
  $nextToken: String
) {
  listFavorites(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      userSub
      drinkID
      createdAt
      updatedAt
      owner
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListFavoritesQueryVariables,
  APITypes.ListFavoritesQuery
>;
