import { connectToDatabase } from './lib/db';
import { Estimate } from './lib/models';
async function run() {
  await connectToDatabase();
  const est = await Estimate.findOne({});
  console.log("Estimate example:", est);
  process.exit(0);
}
run();
