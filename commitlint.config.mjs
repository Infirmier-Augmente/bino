// Conventional Commits : https://www.conventionalcommits.org/fr/
// Exemple : "feat(mobile): bouton de dictée push-to-talk"
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['domain', 'ai', 'simulation', 'api', 'mobile', 'e2e', 'docs', 'ci', 'repo', 'deps'],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
