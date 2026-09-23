import 'react-native';
import React from 'react';
import App from '../App';
import renderer, { act } from 'react-test-renderer';

it('renders auth gate (login screen saat belum login)', async () => {
  let tree: renderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  expect(tree).toBeDefined();
  const loginButtons = tree!.root.findAll(
    (node) => node.props?.title === 'Masuk',
  );
  expect(loginButtons.length).toBeGreaterThan(0);
  tree!.unmount();
});
