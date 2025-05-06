export const formatUserDataResponse = (user: any) => {
  return {
    id: user.id,
    email: user.email,
    name: user.personalInfo
      ? `${user.personalInfo.firstName} ${user.personalInfo.lastName}`
      : null,
    referralCode: user.referralCode,
    photo: user.photo,
  };
};