// Configuration AWS de FaBrary lue dans le code du site.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { findFabraryConfig } = await import('../../app/src/main/assets/www/js/fabrary.js');

test('configuration Amplify minifiée', () => {
  const code = 'const e={aws_project_region:"us-east-2",aws_cognito_identity_pool_id:"us-east-2:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",aws_appsync_graphqlEndpoint:"https://abcdefghij0123456789klmnop.appsync-api.us-east-2.amazonaws.com/graphql",aws_appsync_authenticationType:"AWS_IAM"};';
  assert.deepEqual(findFabraryConfig(code), {
    identityPoolId: 'us-east-2:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    endpoint: 'https://abcdefghij0123456789klmnop.appsync-api.us-east-2.amazonaws.com/graphql',
    region: 'us-east-2',
  });
});

test('autre région, guillemets simples, sans API', () => {
  assert.deepEqual(findFabraryConfig("identityPoolId:'eu-west-1:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'"), {
    identityPoolId: 'eu-west-1:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    endpoint: null,
    region: 'eu-west-1',
  });
  assert.deepEqual(findFabraryConfig('rien ici'), { identityPoolId: null, endpoint: null, region: null });
});
