import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';

async function inspect(filePath) {
  const io = new NodeIO();
  const document = await io.read(filePath);
  const root = document.getRoot();
  
  console.log(`\n--- Inspecting ${filePath} ---`);
  const nodes = root.listNodes();
  nodes.forEach(node => {
    console.log(`Node: ${node.getName()} | Children: ${node.listChildren().length} | Mesh: ${node.getMesh() ? 'Yes' : 'No'}`);
  });
}

async function main() {
  await inspect('frontend/public/models/cute_rabbit.glb');
  await inspect('frontend/public/models/aqua_sparkle_sprite.glb');
  await inspect('frontend/public/models/enchanted_forest_sprite.glb');
}

main().catch(console.error);
