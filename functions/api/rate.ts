export async function onRequestPost(context: any) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { movieId, username, score } = body;

    // Validate inputs
    if (!movieId || !username || typeof score !== 'number' || score < 1 || score > 10) {
      return new Response("Invalid payload", { status: 400 });
    }

    // 1. Insert or update the user's rating
    await env.DB.prepare(`
      INSERT INTO ratings (movie_id, username, score) 
      VALUES (?, ?, ?)
      ON CONFLICT(movie_id, username) DO UPDATE SET score = excluded.score
    `).bind(movieId, username, score).run();

    // 2. Recalculate the true average score for the movie
    const { results } = await env.DB.prepare(`
      SELECT ROUND(AVG(score), 1) as avg_rating 
      FROM ratings 
      WHERE movie_id = ?
    `).bind(movieId).all();

    const newAvg = results[0].avg_rating || null;

    return Response.json({ success: true, newAvg });
    
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}