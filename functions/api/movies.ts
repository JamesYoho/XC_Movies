export async function onRequestGet(context: any) {
  const { results } = await context.env.DB.prepare(
    "SELECT * FROM movies WHERE status = 'watchlist' ORDER BY votes DESC"
  ).all();
  return Response.json(results);
}
export async function onRequestPost(context: any) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { title, image_url, username } = body;

    if (!title || !username) {
      return new Response("Missing title or username", { status: 400 });
    }

    // 1. Insert the movie with 0 votes and get its generated ID back
    const insertedMovie = await env.DB.prepare(`
      INSERT INTO movies (title, image_url, status, votes) 
      VALUES (?, ?, 'watchlist', 0)
      RETURNING id
    `).bind(title, image_url || null).first();

    // 2. Return the new movie ID (we no longer insert a vote here)
    return Response.json({ success: true, id: insertedMovie.id });
    
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}