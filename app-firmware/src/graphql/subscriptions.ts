/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateUser = /* GraphQL */ `subscription OnCreateUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onCreateUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserSubscriptionVariables,
  APITypes.OnCreateUserSubscription
>;
export const onUpdateUser = /* GraphQL */ `subscription OnUpdateUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onUpdateUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserSubscriptionVariables,
  APITypes.OnUpdateUserSubscription
>;
export const onDeleteUser = /* GraphQL */ `subscription OnDeleteUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onDeleteUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserSubscriptionVariables,
  APITypes.OnDeleteUserSubscription
>;
export const onCreateUserFavorite = /* GraphQL */ `subscription OnCreateUserFavorite(
  $filter: ModelSubscriptionUserFavoriteFilterInput
  $owner: String
) {
  onCreateUserFavorite(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserFavoriteSubscriptionVariables,
  APITypes.OnCreateUserFavoriteSubscription
>;
export const onUpdateUserFavorite = /* GraphQL */ `subscription OnUpdateUserFavorite(
  $filter: ModelSubscriptionUserFavoriteFilterInput
  $owner: String
) {
  onUpdateUserFavorite(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserFavoriteSubscriptionVariables,
  APITypes.OnUpdateUserFavoriteSubscription
>;
export const onDeleteUserFavorite = /* GraphQL */ `subscription OnDeleteUserFavorite(
  $filter: ModelSubscriptionUserFavoriteFilterInput
  $owner: String
) {
  onDeleteUserFavorite(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserFavoriteSubscriptionVariables,
  APITypes.OnDeleteUserFavoriteSubscription
>;
export const onCreateIngredient = /* GraphQL */ `subscription OnCreateIngredient(
  $filter: ModelSubscriptionIngredientFilterInput
  $owner: String
) {
  onCreateIngredient(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateIngredientSubscriptionVariables,
  APITypes.OnCreateIngredientSubscription
>;
export const onUpdateIngredient = /* GraphQL */ `subscription OnUpdateIngredient(
  $filter: ModelSubscriptionIngredientFilterInput
  $owner: String
) {
  onUpdateIngredient(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateIngredientSubscriptionVariables,
  APITypes.OnUpdateIngredientSubscription
>;
export const onDeleteIngredient = /* GraphQL */ `subscription OnDeleteIngredient(
  $filter: ModelSubscriptionIngredientFilterInput
  $owner: String
) {
  onDeleteIngredient(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteIngredientSubscriptionVariables,
  APITypes.OnDeleteIngredientSubscription
>;
export const onCreateDrink = /* GraphQL */ `subscription OnCreateDrink(
  $filter: ModelSubscriptionDrinkFilterInput
  $owner: String
) {
  onCreateDrink(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateDrinkSubscriptionVariables,
  APITypes.OnCreateDrinkSubscription
>;
export const onUpdateDrink = /* GraphQL */ `subscription OnUpdateDrink(
  $filter: ModelSubscriptionDrinkFilterInput
  $owner: String
) {
  onUpdateDrink(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateDrinkSubscriptionVariables,
  APITypes.OnUpdateDrinkSubscription
>;
export const onDeleteDrink = /* GraphQL */ `subscription OnDeleteDrink(
  $filter: ModelSubscriptionDrinkFilterInput
  $owner: String
) {
  onDeleteDrink(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteDrinkSubscriptionVariables,
  APITypes.OnDeleteDrinkSubscription
>;
export const onCreateDrinkIngredient = /* GraphQL */ `subscription OnCreateDrinkIngredient(
  $filter: ModelSubscriptionDrinkIngredientFilterInput
  $owner: String
) {
  onCreateDrinkIngredient(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateDrinkIngredientSubscriptionVariables,
  APITypes.OnCreateDrinkIngredientSubscription
>;
export const onUpdateDrinkIngredient = /* GraphQL */ `subscription OnUpdateDrinkIngredient(
  $filter: ModelSubscriptionDrinkIngredientFilterInput
  $owner: String
) {
  onUpdateDrinkIngredient(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateDrinkIngredientSubscriptionVariables,
  APITypes.OnUpdateDrinkIngredientSubscription
>;
export const onDeleteDrinkIngredient = /* GraphQL */ `subscription OnDeleteDrinkIngredient(
  $filter: ModelSubscriptionDrinkIngredientFilterInput
  $owner: String
) {
  onDeleteDrinkIngredient(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteDrinkIngredientSubscriptionVariables,
  APITypes.OnDeleteDrinkIngredientSubscription
>;
