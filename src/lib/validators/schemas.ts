export const schemas = {
  openingBook: {
    required: ["name", "color", "rootFen"],
  },
  session: {
    required: ["bookId", "startedAt"],
  },
};
