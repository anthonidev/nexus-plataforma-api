export const formatUserResponse = (user: any) => {
  return {
      id: user.id,
      email: user.email,
      personalInfo: {
        firstName: user.personalInfo.firstName,
        lastName: user.personalInfo.lastName,
        documentNumber: user.personalInfo.documentNumber,
      },
  };
};