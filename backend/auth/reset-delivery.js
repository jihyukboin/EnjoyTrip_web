export function createResetDelivery(config) {
  if (config.resetDeliveryMode !== 'console') return null;
  // readConfig allows this only for explicitly enabled local development.
  return ({ email, token, memberExists }) => {
    if (memberExists) console.log(`[local password reset] ${email}\nToken: ${token}\nValid for 15 minutes. Submit to POST /api/auth/password-resets.`);
  };
}
