import {temp_license, license_verifier} from '../src/template_for_license.js'
import { expect, test } from 'vitest'
// import {describe, expect, test} from '@jest/globals'

// test('Test for license', async () => {
//     expect(await temp_license('https://github.com/socketio/socket.io', 'test/testing_data/repos_to_test/socket.io')).toBe(true);
// });

test('Test for license', async () => {
    expect( await license_verifier('MIT')).toBe(true);
});

test('Test for license', async () => {
    expect(await temp_license('invalid url', "invalid path")).toBe(false);
}   );  


