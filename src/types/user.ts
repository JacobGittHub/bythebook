export type UserPreferences = {
  boardTheme: "classic" | "blue" | "green";
  autoFlipForBlack: boolean;
  showEngine: boolean;
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  preferences: UserPreferences;
};
