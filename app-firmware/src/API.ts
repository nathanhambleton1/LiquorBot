/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateUserInput = {
  id?: string | null,
  username?: string | null,
  email?: string | null,
};

export type ModelUserConditionInput = {
  username?: ModelStringInput | null,
  email?: ModelStringInput | null,
  and?: Array< ModelUserConditionInput | null > | null,
  or?: Array< ModelUserConditionInput | null > | null,
  not?: ModelUserConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type User = {
  __typename: "User",
  id: string,
  username?: string | null,
  email?: string | null,
  favorites?: ModelUserFavoriteConnection | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type ModelUserFavoriteConnection = {
  __typename: "ModelUserFavoriteConnection",
  items:  Array<UserFavorite | null >,
  nextToken?: string | null,
};

export type UserFavorite = {
  __typename: "UserFavorite",
  id: string,
  userID: string,
  drinkID: string,
  user?: User | null,
  drink?: Drink | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type Drink = {
  __typename: "Drink",
  id: string,
  name: string,
  category?: string | null,
  description?: string | null,
  garnish?: string | null,
  image?: string | null,
  ingredients?: ModelDrinkIngredientConnection | null,
  favorites?: ModelUserFavoriteConnection | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type ModelDrinkIngredientConnection = {
  __typename: "ModelDrinkIngredientConnection",
  items:  Array<DrinkIngredient | null >,
  nextToken?: string | null,
};

export type DrinkIngredient = {
  __typename: "DrinkIngredient",
  id: string,
  amount?: number | null,
  unit?: string | null,
  drinkID: string,
  ingredientID: string,
  ingredient?: Ingredient | null,
  drink?: Drink | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type Ingredient = {
  __typename: "Ingredient",
  id: string,
  name: string,
  drinkIngredients?: ModelDrinkIngredientConnection | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateUserInput = {
  id: string,
  username?: string | null,
  email?: string | null,
};

export type DeleteUserInput = {
  id: string,
};

export type CreateUserFavoriteInput = {
  id?: string | null,
  userID: string,
  drinkID: string,
};

export type ModelUserFavoriteConditionInput = {
  userID?: ModelIDInput | null,
  drinkID?: ModelIDInput | null,
  and?: Array< ModelUserFavoriteConditionInput | null > | null,
  or?: Array< ModelUserFavoriteConditionInput | null > | null,
  not?: ModelUserFavoriteConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export type UpdateUserFavoriteInput = {
  id: string,
  userID?: string | null,
  drinkID?: string | null,
};

export type DeleteUserFavoriteInput = {
  id: string,
};

export type CreateIngredientInput = {
  id?: string | null,
  name: string,
};

export type ModelIngredientConditionInput = {
  name?: ModelStringInput | null,
  and?: Array< ModelIngredientConditionInput | null > | null,
  or?: Array< ModelIngredientConditionInput | null > | null,
  not?: ModelIngredientConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type UpdateIngredientInput = {
  id: string,
  name?: string | null,
};

export type DeleteIngredientInput = {
  id: string,
};

export type CreateDrinkInput = {
  id?: string | null,
  name: string,
  category?: string | null,
  description?: string | null,
  garnish?: string | null,
  image?: string | null,
};

export type ModelDrinkConditionInput = {
  name?: ModelStringInput | null,
  category?: ModelStringInput | null,
  description?: ModelStringInput | null,
  garnish?: ModelStringInput | null,
  image?: ModelStringInput | null,
  and?: Array< ModelDrinkConditionInput | null > | null,
  or?: Array< ModelDrinkConditionInput | null > | null,
  not?: ModelDrinkConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type UpdateDrinkInput = {
  id: string,
  name?: string | null,
  category?: string | null,
  description?: string | null,
  garnish?: string | null,
  image?: string | null,
};

export type DeleteDrinkInput = {
  id: string,
};

export type CreateDrinkIngredientInput = {
  id?: string | null,
  amount?: number | null,
  unit?: string | null,
  drinkID: string,
  ingredientID: string,
};

export type ModelDrinkIngredientConditionInput = {
  amount?: ModelFloatInput | null,
  unit?: ModelStringInput | null,
  drinkID?: ModelIDInput | null,
  ingredientID?: ModelIDInput | null,
  and?: Array< ModelDrinkIngredientConditionInput | null > | null,
  or?: Array< ModelDrinkIngredientConditionInput | null > | null,
  not?: ModelDrinkIngredientConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type ModelFloatInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type UpdateDrinkIngredientInput = {
  id: string,
  amount?: number | null,
  unit?: string | null,
  drinkID?: string | null,
  ingredientID?: string | null,
};

export type DeleteDrinkIngredientInput = {
  id: string,
};

export type ModelUserFilterInput = {
  id?: ModelIDInput | null,
  username?: ModelStringInput | null,
  email?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserFilterInput | null > | null,
  or?: Array< ModelUserFilterInput | null > | null,
  not?: ModelUserFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelUserConnection = {
  __typename: "ModelUserConnection",
  items:  Array<User | null >,
  nextToken?: string | null,
};

export type ModelUserFavoriteFilterInput = {
  id?: ModelIDInput | null,
  userID?: ModelIDInput | null,
  drinkID?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserFavoriteFilterInput | null > | null,
  or?: Array< ModelUserFavoriteFilterInput | null > | null,
  not?: ModelUserFavoriteFilterInput | null,
  owner?: ModelStringInput | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelIngredientFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelIngredientFilterInput | null > | null,
  or?: Array< ModelIngredientFilterInput | null > | null,
  not?: ModelIngredientFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelIngredientConnection = {
  __typename: "ModelIngredientConnection",
  items:  Array<Ingredient | null >,
  nextToken?: string | null,
};

export type ModelDrinkFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  category?: ModelStringInput | null,
  description?: ModelStringInput | null,
  garnish?: ModelStringInput | null,
  image?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelDrinkFilterInput | null > | null,
  or?: Array< ModelDrinkFilterInput | null > | null,
  not?: ModelDrinkFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelDrinkConnection = {
  __typename: "ModelDrinkConnection",
  items:  Array<Drink | null >,
  nextToken?: string | null,
};

export type ModelDrinkIngredientFilterInput = {
  id?: ModelIDInput | null,
  amount?: ModelFloatInput | null,
  unit?: ModelStringInput | null,
  drinkID?: ModelIDInput | null,
  ingredientID?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelDrinkIngredientFilterInput | null > | null,
  or?: Array< ModelDrinkIngredientFilterInput | null > | null,
  not?: ModelDrinkIngredientFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionUserFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  username?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionUserFavoriteFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  userID?: ModelSubscriptionIDInput | null,
  drinkID?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserFavoriteFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserFavoriteFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionIngredientFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionIngredientFilterInput | null > | null,
  or?: Array< ModelSubscriptionIngredientFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionDrinkFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  category?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  garnish?: ModelSubscriptionStringInput | null,
  image?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionDrinkFilterInput | null > | null,
  or?: Array< ModelSubscriptionDrinkFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionDrinkIngredientFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  amount?: ModelSubscriptionFloatInput | null,
  unit?: ModelSubscriptionStringInput | null,
  drinkID?: ModelSubscriptionIDInput | null,
  ingredientID?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionDrinkIngredientFilterInput | null > | null,
  or?: Array< ModelSubscriptionDrinkIngredientFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionFloatInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type CreateUserMutationVariables = {
  input: CreateUserInput,
  condition?: ModelUserConditionInput | null,
};

export type CreateUserMutation = {
  createUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateUserMutationVariables = {
  input: UpdateUserInput,
  condition?: ModelUserConditionInput | null,
};

export type UpdateUserMutation = {
  updateUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteUserMutationVariables = {
  input: DeleteUserInput,
  condition?: ModelUserConditionInput | null,
};

export type DeleteUserMutation = {
  deleteUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateUserFavoriteMutationVariables = {
  input: CreateUserFavoriteInput,
  condition?: ModelUserFavoriteConditionInput | null,
};

export type CreateUserFavoriteMutation = {
  createUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateUserFavoriteMutationVariables = {
  input: UpdateUserFavoriteInput,
  condition?: ModelUserFavoriteConditionInput | null,
};

export type UpdateUserFavoriteMutation = {
  updateUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteUserFavoriteMutationVariables = {
  input: DeleteUserFavoriteInput,
  condition?: ModelUserFavoriteConditionInput | null,
};

export type DeleteUserFavoriteMutation = {
  deleteUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateIngredientMutationVariables = {
  input: CreateIngredientInput,
  condition?: ModelIngredientConditionInput | null,
};

export type CreateIngredientMutation = {
  createIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateIngredientMutationVariables = {
  input: UpdateIngredientInput,
  condition?: ModelIngredientConditionInput | null,
};

export type UpdateIngredientMutation = {
  updateIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteIngredientMutationVariables = {
  input: DeleteIngredientInput,
  condition?: ModelIngredientConditionInput | null,
};

export type DeleteIngredientMutation = {
  deleteIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateDrinkMutationVariables = {
  input: CreateDrinkInput,
  condition?: ModelDrinkConditionInput | null,
};

export type CreateDrinkMutation = {
  createDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateDrinkMutationVariables = {
  input: UpdateDrinkInput,
  condition?: ModelDrinkConditionInput | null,
};

export type UpdateDrinkMutation = {
  updateDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteDrinkMutationVariables = {
  input: DeleteDrinkInput,
  condition?: ModelDrinkConditionInput | null,
};

export type DeleteDrinkMutation = {
  deleteDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateDrinkIngredientMutationVariables = {
  input: CreateDrinkIngredientInput,
  condition?: ModelDrinkIngredientConditionInput | null,
};

export type CreateDrinkIngredientMutation = {
  createDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateDrinkIngredientMutationVariables = {
  input: UpdateDrinkIngredientInput,
  condition?: ModelDrinkIngredientConditionInput | null,
};

export type UpdateDrinkIngredientMutation = {
  updateDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteDrinkIngredientMutationVariables = {
  input: DeleteDrinkIngredientInput,
  condition?: ModelDrinkIngredientConditionInput | null,
};

export type DeleteDrinkIngredientMutation = {
  deleteDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type GetUserQueryVariables = {
  id: string,
};

export type GetUserQuery = {
  getUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListUsersQueryVariables = {
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListUsersQuery = {
  listUsers?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetUserFavoriteQueryVariables = {
  id: string,
};

export type GetUserFavoriteQuery = {
  getUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListUserFavoritesQueryVariables = {
  filter?: ModelUserFavoriteFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListUserFavoritesQuery = {
  listUserFavorites?:  {
    __typename: "ModelUserFavoriteConnection",
    items:  Array< {
      __typename: "UserFavorite",
      id: string,
      userID: string,
      drinkID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UserFavoritesByUserIDQueryVariables = {
  userID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelUserFavoriteFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type UserFavoritesByUserIDQuery = {
  userFavoritesByUserID?:  {
    __typename: "ModelUserFavoriteConnection",
    items:  Array< {
      __typename: "UserFavorite",
      id: string,
      userID: string,
      drinkID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UserFavoritesByDrinkIDQueryVariables = {
  drinkID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelUserFavoriteFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type UserFavoritesByDrinkIDQuery = {
  userFavoritesByDrinkID?:  {
    __typename: "ModelUserFavoriteConnection",
    items:  Array< {
      __typename: "UserFavorite",
      id: string,
      userID: string,
      drinkID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetIngredientQueryVariables = {
  id: string,
};

export type GetIngredientQuery = {
  getIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListIngredientsQueryVariables = {
  filter?: ModelIngredientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListIngredientsQuery = {
  listIngredients?:  {
    __typename: "ModelIngredientConnection",
    items:  Array< {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetDrinkQueryVariables = {
  id: string,
};

export type GetDrinkQuery = {
  getDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListDrinksQueryVariables = {
  filter?: ModelDrinkFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListDrinksQuery = {
  listDrinks?:  {
    __typename: "ModelDrinkConnection",
    items:  Array< {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetDrinkIngredientQueryVariables = {
  id: string,
};

export type GetDrinkIngredientQuery = {
  getDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListDrinkIngredientsQueryVariables = {
  filter?: ModelDrinkIngredientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListDrinkIngredientsQuery = {
  listDrinkIngredients?:  {
    __typename: "ModelDrinkIngredientConnection",
    items:  Array< {
      __typename: "DrinkIngredient",
      id: string,
      amount?: number | null,
      unit?: string | null,
      drinkID: string,
      ingredientID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type DrinkIngredientsByDrinkIDQueryVariables = {
  drinkID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelDrinkIngredientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type DrinkIngredientsByDrinkIDQuery = {
  drinkIngredientsByDrinkID?:  {
    __typename: "ModelDrinkIngredientConnection",
    items:  Array< {
      __typename: "DrinkIngredient",
      id: string,
      amount?: number | null,
      unit?: string | null,
      drinkID: string,
      ingredientID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type DrinkIngredientsByIngredientIDQueryVariables = {
  ingredientID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelDrinkIngredientFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type DrinkIngredientsByIngredientIDQuery = {
  drinkIngredientsByIngredientID?:  {
    __typename: "ModelDrinkIngredientConnection",
    items:  Array< {
      __typename: "DrinkIngredient",
      id: string,
      amount?: number | null,
      unit?: string | null,
      drinkID: string,
      ingredientID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnCreateUserSubscription = {
  onCreateUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnUpdateUserSubscription = {
  onUpdateUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnDeleteUserSubscription = {
  onDeleteUser?:  {
    __typename: "User",
    id: string,
    username?: string | null,
    email?: string | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateUserFavoriteSubscriptionVariables = {
  filter?: ModelSubscriptionUserFavoriteFilterInput | null,
  owner?: string | null,
};

export type OnCreateUserFavoriteSubscription = {
  onCreateUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateUserFavoriteSubscriptionVariables = {
  filter?: ModelSubscriptionUserFavoriteFilterInput | null,
  owner?: string | null,
};

export type OnUpdateUserFavoriteSubscription = {
  onUpdateUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteUserFavoriteSubscriptionVariables = {
  filter?: ModelSubscriptionUserFavoriteFilterInput | null,
  owner?: string | null,
};

export type OnDeleteUserFavoriteSubscription = {
  onDeleteUserFavorite?:  {
    __typename: "UserFavorite",
    id: string,
    userID: string,
    drinkID: string,
    user?:  {
      __typename: "User",
      id: string,
      username?: string | null,
      email?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateIngredientSubscriptionVariables = {
  filter?: ModelSubscriptionIngredientFilterInput | null,
  owner?: string | null,
};

export type OnCreateIngredientSubscription = {
  onCreateIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateIngredientSubscriptionVariables = {
  filter?: ModelSubscriptionIngredientFilterInput | null,
  owner?: string | null,
};

export type OnUpdateIngredientSubscription = {
  onUpdateIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteIngredientSubscriptionVariables = {
  filter?: ModelSubscriptionIngredientFilterInput | null,
  owner?: string | null,
};

export type OnDeleteIngredientSubscription = {
  onDeleteIngredient?:  {
    __typename: "Ingredient",
    id: string,
    name: string,
    drinkIngredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkFilterInput | null,
  owner?: string | null,
};

export type OnCreateDrinkSubscription = {
  onCreateDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkFilterInput | null,
  owner?: string | null,
};

export type OnUpdateDrinkSubscription = {
  onUpdateDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkFilterInput | null,
  owner?: string | null,
};

export type OnDeleteDrinkSubscription = {
  onDeleteDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    garnish?: string | null,
    image?: string | null,
    ingredients?:  {
      __typename: "ModelDrinkIngredientConnection",
      nextToken?: string | null,
    } | null,
    favorites?:  {
      __typename: "ModelUserFavoriteConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateDrinkIngredientSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkIngredientFilterInput | null,
  owner?: string | null,
};

export type OnCreateDrinkIngredientSubscription = {
  onCreateDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateDrinkIngredientSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkIngredientFilterInput | null,
  owner?: string | null,
};

export type OnUpdateDrinkIngredientSubscription = {
  onUpdateDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteDrinkIngredientSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkIngredientFilterInput | null,
  owner?: string | null,
};

export type OnDeleteDrinkIngredientSubscription = {
  onDeleteDrinkIngredient?:  {
    __typename: "DrinkIngredient",
    id: string,
    amount?: number | null,
    unit?: string | null,
    drinkID: string,
    ingredientID: string,
    ingredient?:  {
      __typename: "Ingredient",
      id: string,
      name: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    drink?:  {
      __typename: "Drink",
      id: string,
      name: string,
      category?: string | null,
      description?: string | null,
      garnish?: string | null,
      image?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};
