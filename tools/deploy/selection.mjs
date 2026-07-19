const PROFILE_PATTERN = /^(standalone|cloud)\.(test|staging|production)$/u;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export function validateSideEffectSelection(values) {
  const errors = [];
  if (!values.profile) errors.push('--profile is required');
  if (!values.environment) errors.push('--environment is required');
  if (!values['artifact-id']) errors.push('--artifact-id is required');
  if (!values['artifact-digest']) errors.push('--artifact-digest is required');
  if (!values['rollback-target']) errors.push('--rollback-target is required');
  if (!values['approval-ref']) errors.push('--approval-ref is required');
  if (!values['artifact-evidence']) errors.push('--artifact-evidence is required');

  const match = PROFILE_PATTERN.exec(values.profile ?? '');
  if (values.profile && !match) {
    errors.push('--profile must use <standalone|cloud>.<test|staging|production>');
  }
  if (match && values.environment && match[2] !== values.environment) {
    errors.push(`--environment ${values.environment} does not match profile ${values.profile}`);
  }
  if (values['artifact-digest'] && !DIGEST_PATTERN.test(values['artifact-digest'])) {
    errors.push('--artifact-digest must use sha256:<64 lowercase hex characters>');
  }
  return errors;
}

export function assertSideEffectSelection(values) {
  const errors = validateSideEffectSelection(values);
  if (errors.length > 0) {
    throw new Error(`unsafe deployment selection: ${errors.join('; ')}`);
  }
  return {
    profile: values.profile,
    environment: values.environment,
    artifactId: values['artifact-id'],
    artifactDigest: values['artifact-digest'],
    rollbackTarget: values['rollback-target'],
    approvalRef: values['approval-ref'],
    artifactEvidence: values['artifact-evidence'],
  };
}
