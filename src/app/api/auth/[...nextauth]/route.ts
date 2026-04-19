export async function GET() {
  return Response.json({
    message: "NextAuth route placeholder",
    providers: [],
  });
}

export async function POST() {
  return Response.json({
    message: "NextAuth callback placeholder",
  });
}
