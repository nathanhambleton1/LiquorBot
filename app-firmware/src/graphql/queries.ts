/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getUser = /* GraphQL */ `query GetUser($id: ID!) {
  getUser(id: $id) {
    id
    username
    email
    favorites {
      nextToken
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<APITypes.GetUserQueryVariables, APITypes.GetUserQuery>;
export const listUsers = /* GraphQL */ `query ListUsers(
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
) {
  listUsers(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      username
      email
      createdAt
      updatedAt
      owner
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<APITypes.ListUsersQueryVariables, APITypes.ListUsersQuery>;
export const getUserFavorite = /* GraphQL */ `query GetUserFavorite($id: ID!) {
  getUserFavorite(id: $id) {
    id
    userID
    drinkID
    user {
      id
      username
      email
      createdAt
      updatedAt
      owner
      __typename
    }
    drink {
      id
      name
      category
      description
      garnish
      image
      createdAt
      updatedAt
      owner
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUserFavoriteQueryVariables,
  APITypes.GetUserFavoriteQuery
>;
export const listUserFavorites = /* GraphQL */ `query ListUserFavorites(
  $filter: ModelUserFavoriteFilterInput
  $limit: Int
  $nextToken: String
) {
  listUserFavorites(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      userID
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
  APITypes.ListUserFavoritesQueryVariables,
  APITypes.ListUserFavoritesQuery
>;
export const userFavoritesByUserID = /* GraphQL */ `query UserFavoritesByUserID(
  $userID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelUserFavoriteFilterInput
  $limit: Int
  $nextToken: String
) {
  userFavoritesByUserID(
    userID: $userID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      userID
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
  APITypes.UserFavoritesByUserIDQueryVariables,
  APITypes.UserFavoritesByUserIDQuery
>;
export const userFavoritesByDrinkID = /* GraphQL */ `query UserFavoritesByDrinkID(
  $drinkID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelUserFavoriteFilterInput
  $limit: Int
  $nextToken: String
) {
  userFavoritesByDrinkID(
    drinkID: $drinkID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      userID
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
  APITypes.UserFavoritesByDrinkIDQueryVariables,
  APITypes.UserFavoritesByDrinkIDQuery
>;
export const getIngredient = /* GraphQL */ `query GetIngredient($id: ID!) {
  getIngredient(id: $id) {
    id
    name
    drinkIngredients {
      nextToken
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetIngredientQueryVariables,
  APITypes.GetIngredientQuery
>;
export const listIngredients = /* GraphQL */ `query ListIngredients(
  $filter: ModelIngredientFilterInput
  $limit: Int
  $nextToken: String
) {
  listIngredients(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
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
  APITypes.ListIngredientsQueryVariables,
  APITypes.ListIngredientsQuery
>;
export const getDrink = /* GraphQL */ `query GetDrink($id: ID!) {
  getDrink(id: $id) {
    id
    name
    category
    description
    garnish
    image
    ingredients {
      nextToken
      __typename
    }
    favorites {
      nextToken
      __typename
    }
    createdAt
    updatedAt
    owner
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
      garnish
      image
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
  APITypes.ListDrinksQueryVariables,
  APITypes.ListDrinksQuery
>;
export const getDrinkIngredient = /* GraphQL */ `query GetDrinkIngredient($id: ID!) {
  getDrinkIngredient(id: $id) {
    id
    amount
    unit
    drinkID
    ingredientID
    ingredient {
      id
      name
      createdAt
      updatedAt
      owner
      __typename
    }
    drink {
      id
      name
      category
      description
      garnish
      image
      createdAt
      updatedAt
      owner
      __typename
    }
    createdAt
    updatedAt
    owner
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetDrinkIngredientQueryVariables,
  APITypes.GetDrinkIngredientQuery
>;
export const listDrinkIngredients = /* GraphQL */ `query ListDrinkIngredients(
  $filter: ModelDrinkIngredientFilterInput
  $limit: Int
  $nextToken: String
) {
  listDrinkIngredients(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      amount
      unit
      drinkID
      ingredientID
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
  APITypes.ListDrinkIngredientsQueryVariables,
  APITypes.ListDrinkIngredientsQuery
>;
export const drinkIngredientsByDrinkID = /* GraphQL */ `query DrinkIngredientsByDrinkID(
  $drinkID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelDrinkIngredientFilterInput
  $limit: Int
  $nextToken: String
) {
  drinkIngredientsByDrinkID(
    drinkID: $drinkID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      amount
      unit
      drinkID
      ingredientID
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
  APITypes.DrinkIngredientsByDrinkIDQueryVariables,
  APITypes.DrinkIngredientsByDrinkIDQuery
>;
export const drinkIngredientsByIngredientID = /* GraphQL */ `query DrinkIngredientsByIngredientID(
  $ingredientID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelDrinkIngredientFilterInput
  $limit: Int
  $nextToken: String
) {
  drinkIngredientsByIngredientID(
    ingredientID: $ingredientID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      amount
      unit
      drinkID
      ingredientID
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
  APITypes.DrinkIngredientsByIngredientIDQueryVariables,
  APITypes.DrinkIngredientsByIngredientIDQuery
>;
