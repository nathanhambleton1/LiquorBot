/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateDrinkInput = {
  id?: string | null,
  name: string,
  category?: string | null,
  description?: string | null,
};

export type ModelDrinkConditionInput = {
  name?: ModelStringInput | null,
  category?: ModelStringInput | null,
  description?: ModelStringInput | null,
  and?: Array< ModelDrinkConditionInput | null > | null,
  or?: Array< ModelDrinkConditionInput | null > | null,
  not?: ModelDrinkConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
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

export type Drink = {
  __typename: "Drink",
  id: string,
  name: string,
  category?: string | null,
  description?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateDrinkInput = {
  id: string,
  name?: string | null,
  category?: string | null,
  description?: string | null,
};

export type DeleteDrinkInput = {
  id: string,
};

export type CreateFavoriteInput = {
  id?: string | null,
  userSub: string,
  drinkID: string,
};

export type ModelFavoriteConditionInput = {
  userSub?: ModelStringInput | null,
  drinkID?: ModelIDInput | null,
  and?: Array< ModelFavoriteConditionInput | null > | null,
  or?: Array< ModelFavoriteConditionInput | null > | null,
  not?: ModelFavoriteConditionInput | null,
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

export type Favorite = {
  __typename: "Favorite",
  id: string,
  userSub: string,
  drinkID: string,
  createdAt: string,
  updatedAt: string,
  owner?: string | null,
};

export type UpdateFavoriteInput = {
  id: string,
  userSub?: string | null,
  drinkID?: string | null,
};

export type DeleteFavoriteInput = {
  id: string,
};

export type ModelDrinkFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  category?: ModelStringInput | null,
  description?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelDrinkFilterInput | null > | null,
  or?: Array< ModelDrinkFilterInput | null > | null,
  not?: ModelDrinkFilterInput | null,
};

export type ModelDrinkConnection = {
  __typename: "ModelDrinkConnection",
  items:  Array<Drink | null >,
  nextToken?: string | null,
};

export type ModelFavoriteFilterInput = {
  id?: ModelIDInput | null,
  userSub?: ModelStringInput | null,
  drinkID?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelFavoriteFilterInput | null > | null,
  or?: Array< ModelFavoriteFilterInput | null > | null,
  not?: ModelFavoriteFilterInput | null,
  owner?: ModelStringInput | null,
};

export type ModelFavoriteConnection = {
  __typename: "ModelFavoriteConnection",
  items:  Array<Favorite | null >,
  nextToken?: string | null,
};

export type ModelSubscriptionDrinkFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  category?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionDrinkFilterInput | null > | null,
  or?: Array< ModelSubscriptionDrinkFilterInput | null > | null,
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

export type ModelSubscriptionFavoriteFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  userSub?: ModelSubscriptionStringInput | null,
  drinkID?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionFavoriteFilterInput | null > | null,
  or?: Array< ModelSubscriptionFavoriteFilterInput | null > | null,
  owner?: ModelStringInput | null,
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
    createdAt: string,
    updatedAt: string,
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
    createdAt: string,
    updatedAt: string,
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
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type CreateFavoriteMutationVariables = {
  input: CreateFavoriteInput,
  condition?: ModelFavoriteConditionInput | null,
};

export type CreateFavoriteMutation = {
  createFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type UpdateFavoriteMutationVariables = {
  input: UpdateFavoriteInput,
  condition?: ModelFavoriteConditionInput | null,
};

export type UpdateFavoriteMutation = {
  updateFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type DeleteFavoriteMutationVariables = {
  input: DeleteFavoriteInput,
  condition?: ModelFavoriteConditionInput | null,
};

export type DeleteFavoriteMutation = {
  deleteFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
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
    createdAt: string,
    updatedAt: string,
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
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetFavoriteQueryVariables = {
  id: string,
};

export type GetFavoriteQuery = {
  getFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type ListFavoritesQueryVariables = {
  filter?: ModelFavoriteFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListFavoritesQuery = {
  listFavorites?:  {
    __typename: "ModelFavoriteConnection",
    items:  Array< {
      __typename: "Favorite",
      id: string,
      userSub: string,
      drinkID: string,
      createdAt: string,
      updatedAt: string,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkFilterInput | null,
};

export type OnCreateDrinkSubscription = {
  onCreateDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkFilterInput | null,
};

export type OnUpdateDrinkSubscription = {
  onUpdateDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteDrinkSubscriptionVariables = {
  filter?: ModelSubscriptionDrinkFilterInput | null,
};

export type OnDeleteDrinkSubscription = {
  onDeleteDrink?:  {
    __typename: "Drink",
    id: string,
    name: string,
    category?: string | null,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnCreateFavoriteSubscriptionVariables = {
  filter?: ModelSubscriptionFavoriteFilterInput | null,
  owner?: string | null,
};

export type OnCreateFavoriteSubscription = {
  onCreateFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnUpdateFavoriteSubscriptionVariables = {
  filter?: ModelSubscriptionFavoriteFilterInput | null,
  owner?: string | null,
};

export type OnUpdateFavoriteSubscription = {
  onUpdateFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};

export type OnDeleteFavoriteSubscriptionVariables = {
  filter?: ModelSubscriptionFavoriteFilterInput | null,
  owner?: string | null,
};

export type OnDeleteFavoriteSubscription = {
  onDeleteFavorite?:  {
    __typename: "Favorite",
    id: string,
    userSub: string,
    drinkID: string,
    createdAt: string,
    updatedAt: string,
    owner?: string | null,
  } | null,
};
