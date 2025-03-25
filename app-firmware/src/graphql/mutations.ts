/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createUser = /* GraphQL */ `mutation CreateUser(
  $input: CreateUserInput!
  $condition: ModelUserConditionInput
) {
  createUser(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateUserMutationVariables,
  APITypes.CreateUserMutation
>;
export const updateUser = /* GraphQL */ `mutation UpdateUser(
  $input: UpdateUserInput!
  $condition: ModelUserConditionInput
) {
  updateUser(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateUserMutationVariables,
  APITypes.UpdateUserMutation
>;
export const deleteUser = /* GraphQL */ `mutation DeleteUser(
  $input: DeleteUserInput!
  $condition: ModelUserConditionInput
) {
  deleteUser(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteUserMutationVariables,
  APITypes.DeleteUserMutation
>;
export const createUserFavorite = /* GraphQL */ `mutation CreateUserFavorite(
  $input: CreateUserFavoriteInput!
  $condition: ModelUserFavoriteConditionInput
) {
  createUserFavorite(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateUserFavoriteMutationVariables,
  APITypes.CreateUserFavoriteMutation
>;
export const updateUserFavorite = /* GraphQL */ `mutation UpdateUserFavorite(
  $input: UpdateUserFavoriteInput!
  $condition: ModelUserFavoriteConditionInput
) {
  updateUserFavorite(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateUserFavoriteMutationVariables,
  APITypes.UpdateUserFavoriteMutation
>;
export const deleteUserFavorite = /* GraphQL */ `mutation DeleteUserFavorite(
  $input: DeleteUserFavoriteInput!
  $condition: ModelUserFavoriteConditionInput
) {
  deleteUserFavorite(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteUserFavoriteMutationVariables,
  APITypes.DeleteUserFavoriteMutation
>;
export const createIngredient = /* GraphQL */ `mutation CreateIngredient(
  $input: CreateIngredientInput!
  $condition: ModelIngredientConditionInput
) {
  createIngredient(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateIngredientMutationVariables,
  APITypes.CreateIngredientMutation
>;
export const updateIngredient = /* GraphQL */ `mutation UpdateIngredient(
  $input: UpdateIngredientInput!
  $condition: ModelIngredientConditionInput
) {
  updateIngredient(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateIngredientMutationVariables,
  APITypes.UpdateIngredientMutation
>;
export const deleteIngredient = /* GraphQL */ `mutation DeleteIngredient(
  $input: DeleteIngredientInput!
  $condition: ModelIngredientConditionInput
) {
  deleteIngredient(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteIngredientMutationVariables,
  APITypes.DeleteIngredientMutation
>;
export const createDrink = /* GraphQL */ `mutation CreateDrink(
  $input: CreateDrinkInput!
  $condition: ModelDrinkConditionInput
) {
  createDrink(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteDrinkMutationVariables,
  APITypes.DeleteDrinkMutation
>;
export const createDrinkIngredient = /* GraphQL */ `mutation CreateDrinkIngredient(
  $input: CreateDrinkIngredientInput!
  $condition: ModelDrinkIngredientConditionInput
) {
  createDrinkIngredient(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateDrinkIngredientMutationVariables,
  APITypes.CreateDrinkIngredientMutation
>;
export const updateDrinkIngredient = /* GraphQL */ `mutation UpdateDrinkIngredient(
  $input: UpdateDrinkIngredientInput!
  $condition: ModelDrinkIngredientConditionInput
) {
  updateDrinkIngredient(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateDrinkIngredientMutationVariables,
  APITypes.UpdateDrinkIngredientMutation
>;
export const deleteDrinkIngredient = /* GraphQL */ `mutation DeleteDrinkIngredient(
  $input: DeleteDrinkIngredientInput!
  $condition: ModelDrinkIngredientConditionInput
) {
  deleteDrinkIngredient(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteDrinkIngredientMutationVariables,
  APITypes.DeleteDrinkIngredientMutation
>;
