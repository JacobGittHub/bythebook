// Makes one-time beta codes and prints them. Run it locally with `npm run invites:create`;
// it reads .env.local and uses the service role key. A code is shown only here: the
// database keeps its hash, so a lost code can't be recovered, only replaced.
//
//   npm run invites:create                              one invite code
//   npm run invites:create -- --count 5                 five invite codes
//   npm run invites:create -- --reset tester@mail.com   a password reset code for that account
import { parseArgs } from "node:util";
import { countInviteCodes, createAccessCode } from "@/lib/db/accessCodes";
import { findUserIdByEmail } from "@/lib/db/users";

async function main() {
  const { values } = parseArgs({
    options: {
      count: { type: "string", default: "1" },
      reset: { type: "string" },
    },
  });

  if (values.reset !== undefined) {
    const userId = await findUserIdByEmail(values.reset);
    if (!userId) throw new Error(`No account has the email "${values.reset}".`);

    console.log(`Reset code for ${values.reset} (enter it at /auth/reset):`);
    console.log(`  ${await createAccessCode("reset", userId)}`);
    return;
  }

  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`--count must be a whole number of at least 1, got "${values.count}".`);
  }

  console.log(`Invite code${count === 1 ? "" : "s"} (enter at /auth/register):`);
  for (let made = 0; made < count; made++) {
    console.log(`  ${await createAccessCode("invite")}`);
  }

  const { total, claimed } = await countInviteCodes();
  console.log(`${total} invite codes exist: ${claimed} used, ${total - claimed} unused.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
