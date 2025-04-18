/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateLikedDrinkInput = {
  id?: string | null,
  userID?: string | null,
  drinkID?: number | null,
  createdAt?: string | null,
};

export type ModelLikedDrinkConditionInput = {
  userID?: ModelIDInput | null,
  drinkID?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelLikedDrinkConditionInput | null > | null,
  or?: Array< ModelLikedDrinkConditionInput | null > | null,
  not?: ModelLikedDrinkConditionInput | null,
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

export type ModelIntInput = {
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

export type LikedDrink = {
  __typename: "LikedDrink",
  id: string,
  userID?: string | null,
  drinkID?: number | null,
  createdAt?: string | null,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateLikedDrinkInput = {
  id: string,
  userID?: string | null,
  drinkID?: number | null,
  createdAt?: string | null,
};

export type DeleteLikedDrinkInput = {
  id: string,
};

export type CreateCustomRecipeInput = {
  id?: string | null,
  name?: string | null,
  description?: string | null,
  ingredients?: RecipeIngredientInput | null,
  createdAt?: string | null,
};

export type RecipeIngredientInput = {
  ingredientID?: string | null,
  amount?: number | null,
  priority?: number | null,
};

export type ModelCustomRecipeConditionInput = {
  name?: ModelStringInput | null,
  description?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelCustomRecipeConditionInput | null > | null,
  or?: Array< ModelCustomRecipeConditionInput | null > | null,
  not?: ModelCustomRecipeConditionInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type CustomRecipe = {
  __typename: "CustomRecipe",
  id: string,
  name?: string | null,
  description?: string | null,
  ingredients?: RecipeIngredient | null,
  createdAt?: string | null,
  updatedAt: string,
  owner?: string | null,
};

export type RecipeIngredient = {
  __typename: "RecipeIngredient",
  ingredientID?: string | null,
  amount?: number | null,
  priority?: number | null,
};

export type UpdateCustomRecipeInput = {
  id: string,
  name?: string | null,
  description?: string | null,
  ingredients?: RecipeIngredientInput | null,
  createdAt?: string | null,
};

export type DeleteCustomRecipeInput = {
  id: string,
};

export type CreateUserProfileInput = {
  id?: string | null,
  username?: string | null,
  bio?: string | null,
  role?: string | null,
  profilePicture?: string | null,
};

export type ModelUserProfileConditionInput = {
  username?: ModelStringInput | null,
  bio?: ModelStringInput | null,
  role?: ModelStringInput | null,
  profilePicture?: ModelStringInput | null,
  and?: Array< ModelUserProfileConditionInput | null > | null,
  or?: Array< ModelUserProfileConditionInput | null > | null,
  not?: ModelUserProfileConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  owner?: ModelStringInput | null,
};

export type UserProfile = {
  __typename: "UserProfile",
  id: string,
  username?: string | null,
  bio?: string | null,
  role?: string | null,
  profilePicture?: string | null,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateUserProfileInput = {
  id: string,
  username?: string | null,
  bio?: string | null,
  role?: string | null,
  profilePicture?: string | null,
};

export type DeleteUserProfileInput = {
  id: string,
};

export type ModelLikedDrinkFilterInput = {
  id?: ModelIDInput | null,
  userID?: ModelIDInput | null,
  drinkID?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelLikedDrinkFilterInput | null > | null,
  or?: Array< ModelLikedDrinkFilterInput | null > | null,
  not?: ModelLikedDrinkFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelLikedDrinkConnection = {
  __typename: "ModelLikedDrinkConnection",
  items:  Array<LikedDrink | null >,
  nextToken?: string | null,
};

export type ModelCustomRecipeFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  description?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelCustomRecipeFilterInput | null > | null,
  or?: Array< ModelCustomRecipeFilterInput | null > | null,
  not?: ModelCustomRecipeFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelCustomRecipeConnection = {
  __typename: "ModelCustomRecipeConnection",
  items:  Array<CustomRecipe | null >,
  nextToken?: string | null,
};

export type ModelUserProfileFilterInput = {
  id?: ModelIDInput | null,
  username?: ModelStringInput | null,
  bio?: ModelStringInput | null,
  role?: ModelStringInput | null,
  profilePicture?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserProfileFilterInput | null > | null,
  or?: Array< ModelUserProfileFilterInput | null > | null,
  not?: ModelUserProfileFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelUserProfileConnection = {
  __typename: "ModelUserProfileConnection",
  items:  Array<UserProfile | null >,
  nextToken?: string | null,
};

export type ModelSubscriptionLikedDrinkFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  userID?: ModelSubscriptionIDInput | null,
  drinkID?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionLikedDrinkFilterInput | null > | null,
  or?: Array< ModelSubscriptionLikedDrinkFilterInput | null > | null,
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

export type ModelSubscriptionIntInput = {
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

export type ModelSubscriptionCustomRecipeFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionCustomRecipeFilterInput | null > | null,
  or?: Array< ModelSubscriptionCustomRecipeFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type ModelSubscriptionUserProfileFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  username?: ModelSubscriptionStringInput | null,
  bio?: ModelSubscriptionStringInput | null,
  role?: ModelSubscriptionStringInput | null,
  profilePicture?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserProfileFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserProfileFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type CreateLikedDrinkMutationVariables = {
  input: CreateLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type CreateLikedDrinkMutation = {
  createLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateLikedDrinkMutationVariables = {
  input: UpdateLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type UpdateLikedDrinkMutation = {
  updateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteLikedDrinkMutationVariables = {
  input: DeleteLikedDrinkInput,
  condition?: ModelLikedDrinkConditionInput | null,
};

export type DeleteLikedDrinkMutation = {
  deleteLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateCustomRecipeMutationVariables = {
  input: CreateCustomRecipeInput,
  condition?: ModelCustomRecipeConditionInput | null,
};

export type CreateCustomRecipeMutation = {
  createCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateCustomRecipeMutationVariables = {
  input: UpdateCustomRecipeInput,
  condition?: ModelCustomRecipeConditionInput | null,
};

export type UpdateCustomRecipeMutation = {
  updateCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteCustomRecipeMutationVariables = {
  input: DeleteCustomRecipeInput,
  condition?: ModelCustomRecipeConditionInput | null,
};

export type DeleteCustomRecipeMutation = {
  deleteCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type CreateUserProfileMutationVariables = {
  input: CreateUserProfileInput,
  condition?: ModelUserProfileConditionInput | null,
};

export type CreateUserProfileMutation = {
  createUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateUserProfileMutationVariables = {
  input: UpdateUserProfileInput,
  condition?: ModelUserProfileConditionInput | null,
};

export type UpdateUserProfileMutation = {
  updateUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteUserProfileMutationVariables = {
  input: DeleteUserProfileInput,
  condition?: ModelUserProfileConditionInput | null,
};

export type DeleteUserProfileMutation = {
  deleteUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type GetLikedDrinkQueryVariables = {
  id: string,
};

export type GetLikedDrinkQuery = {
  getLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListLikedDrinksQueryVariables = {
  filter?: ModelLikedDrinkFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListLikedDrinksQuery = {
  listLikedDrinks?:  {
    __typename: "ModelLikedDrinkConnection",
    items:  Array< {
      __typename: "LikedDrink",
      id: string,
      userID?: string | null,
      drinkID?: number | null,
      createdAt?: string | null,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetCustomRecipeQueryVariables = {
  id: string,
};

export type GetCustomRecipeQuery = {
  getCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListCustomRecipesQueryVariables = {
  filter?: ModelCustomRecipeFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListCustomRecipesQuery = {
  listCustomRecipes?:  {
    __typename: "ModelCustomRecipeConnection",
    items:  Array< {
      __typename: "CustomRecipe",
      id: string,
      name?: string | null,
      description?: string | null,
      createdAt?: string | null,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetUserProfileQueryVariables = {
  id: string,
};

export type GetUserProfileQuery = {
  getUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListUserProfilesQueryVariables = {
  filter?: ModelUserProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListUserProfilesQuery = {
  listUserProfiles?:  {
    __typename: "ModelUserProfileConnection",
    items:  Array< {
      __typename: "UserProfile",
      id: string,
      username?: string | null,
      bio?: string | null,
      role?: string | null,
      profilePicture?: string | null,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  owner?: string | null,
};

export type OnCreateLikedDrinkSubscription = {
  onCreateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  owner?: string | null,
};

export type OnUpdateLikedDrinkSubscription = {
  onUpdateLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteLikedDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionLikedDrinkFilterInput | null,
  owner?: string | null,
};

export type OnDeleteLikedDrinkSubscription = {
  onDeleteLikedDrink?:  {
    __typename: "LikedDrink",
    id: string,
    userID?: string | null,
    drinkID?: number | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateCustomRecipeSubscriptionVariables = {
  filter?: ModelSubscriptionCustomRecipeFilterInput | null,
  owner?: string | null,
};

export type OnCreateCustomRecipeSubscription = {
  onCreateCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateCustomRecipeSubscriptionVariables = {
  filter?: ModelSubscriptionCustomRecipeFilterInput | null,
  owner?: string | null,
};

export type OnUpdateCustomRecipeSubscription = {
  onUpdateCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteCustomRecipeSubscriptionVariables = {
  filter?: ModelSubscriptionCustomRecipeFilterInput | null,
  owner?: string | null,
};

export type OnDeleteCustomRecipeSubscription = {
  onDeleteCustomRecipe?:  {
    __typename: "CustomRecipe",
    id: string,
    name?: string | null,
    description?: string | null,
    ingredients?:  {
      __typename: "RecipeIngredient",
      ingredientID?: string | null,
      amount?: number | null,
      priority?: number | null,
    } | null,
    createdAt?: string | null,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnCreateUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
  owner?: string | null,
};

export type OnCreateUserProfileSubscription = {
  onCreateUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
  owner?: string | null,
};

export type OnUpdateUserProfileSubscription = {
  onUpdateUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
  owner?: string | null,
};

export type OnDeleteUserProfileSubscription = {
  onDeleteUserProfile?:  {
    __typename: "UserProfile",
    id: string,
    username?: string | null,
    bio?: string | null,
    role?: string | null,
    profilePicture?: string | null,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};
