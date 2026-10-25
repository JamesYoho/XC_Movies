export async function onRequestGet(context: any) {
  try {
    const { request, env } = context;
    
    // Extract the username from the URL query parameter (e.g., ?user=James)
    const url = new URL(request.url);
    const username = url.searchParams.get('user');

    // We use LEFT JOINs to attach the specific user's vote and rating to each movie,
    // and a subquery to calculate the group's average rating on the fly.
    const { results } = await env.DB.prepare(`
      SELECT 
          m.id, 
          m.title, 
          m.image_url, 
          m.status, 
          m.votes,
          v.vote_dir AS userVote,
          r.score AS userRating,
          (SELECT ROUND(AVG(score), 1) FROM ratings WHERE movie_id = m.id) AS avgRating
      FROM movies m
      LEFT JOIN votes v ON m.id = v.movie_id AND v.username = ?
      LEFT JOIN ratings r ON m.id = r.movie_id AND r.username = ?
      ORDER BY m.votes DESC, m.id DESC
    `).bind(username, username).all();

    return Response.json(results);
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
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