export async function onRequestPost(context: any) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { movieId, username, voteDir } = body;

    // Validate inputs
    if (!movieId || !username || ![1, -1].includes(voteDir)) {
      return new Response("Invalid payload", { status: 400 });
    }

    // 1. Insert or update the user's vote
    // If they already voted on this movie, it overwrites their old vote direction
    await env.DB.prepare(`
      INSERT INTO votes (movie_id, username, vote_dir) 
      VALUES (?, ?, ?)
      ON CONFLICT(movie_id, username) DO UPDATE SET vote_dir = excluded.vote_dir
    `).bind(movieId, username, voteDir).run();

    // 2. Recalculate the true total score for the movie
    const { results } = await env.DB.prepare(`
      SELECT SUM(vote_dir) as total_votes 
      FROM votes 
      WHERE movie_id = ?
    `).bind(movieId).all();

    const newTotal = results[0].total_votes || 0;

    // 3. Cache the new total in the movies table so the main feed loads fast
    await env.DB.prepare(`
      UPDATE movies 
      SET votes = ? 
      WHERE id = ?
    `).bind(newTotal, movieId).run();

    return Response.json({ success: true, newTotal });
    
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}