import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Check, Film, Star, LogOut, Trash2 } from 'lucide-react';
interface Movie {
  id: number;
  title: string;
  image_url: string;
  status: 'watchlist' | 'watched';
  votes: number;
  userVote?: number; // 1 for upvote, -1 for downvote, 0 for none
  userRating?: number; // 1-10
  avgRating?: number;
}

// Populated using your recent team list
const USERS = ['Cole', 'Isaiah', 'James', 'Matt', 'Tim', 'Veronica'];
const ADMIN_PIN = '1234'; // Change this to your actual PIN

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Login State
  const [selectedName, setSelectedName] = useState(USERS[0]);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // App State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'watched'>('watchlist');
  const [newTitle, setNewTitle] = useState('');
  const [newImage, setNewImage] = useState('');

  const fetchMovies = async () => {
    try {
      // In the real app, pass the currentUser so the backend returns their specific votes/ratings
      const response = await fetch(`/api/movies?user=${currentUser}`);
      if (response.ok) {
        const data = await response.json();
        setMovies(data);
      }
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchMovies();
    }
  }, [currentUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (selectedName === 'James') {
      if (pin === ADMIN_PIN) {
        setIsAdmin(true);
        setCurrentUser('James');
      } else {
        setLoginError('Incorrect PIN');
      }
    } else {
      setIsAdmin(false);
      setCurrentUser(selectedName);
    }
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !currentUser) return;

    // 1. Optimistic UI update
    const tempMovie: Movie = {
      id: Date.now(), 
      title: newTitle,
      image_url: newImage,
      status: 'watchlist',
      votes: 0,       // Changed from 1
      userVote: 0     // Changed from 1
    };
    
    setMovies([...movies, tempMovie].sort((a, b) => b.votes - a.votes));
    setNewTitle('');
    setNewImage('');

    // 2. Send the POST request
    try {
      await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tempMovie.title,
          image_url: tempMovie.image_url,
          username: currentUser
        })
      });
      
      fetchMovies(); 
    } catch (error) {
      console.error("Failed to add movie:", error);
    }
  };

  const handleVote = async (id: number, increment: number) => {
    // 1. Optimistic UI update (feels instant to the user)
    setMovies(movies.map(m => {
      if (m.id === id) {
        if (m.userVote === increment) return m; 
        const oldVote = m.userVote || 0;
        return { ...m, votes: m.votes - oldVote + increment, userVote: increment };
      }
      return m;
    }).sort((a, b) => b.votes - a.votes));

    // 2. Send the actual request to Cloudflare
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId: id,
          username: currentUser,
          voteDir: increment
        })
      });
    } catch (error) {
      console.error("Vote failed:", error);
      // Optional: revert the UI state here if the fetch fails
    }
  };

  const handleRate = async (id: number, score: number) => {
    if (!currentUser) return;

    // 1. Optimistic UI update for the user's personal dropdown selection
    setMovies(movies.map(m => 
      m.id === id ? { ...m, userRating: score } : m
    ));

    // 2. Send the request to Cloudflare
    try {
      const response = await fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId: id,
          username: currentUser,
          score: score
        })
      });

      if (response.ok) {
        const data = await response.json();
        // 3. Update the group average rating in the UI
        setMovies(prev => prev.map(m => 
          m.id === id ? { ...m, avgRating: data.newAvg } : m
        ));
      }
    } catch (error) {
      console.error("Failed to rate movie:", error);
    }
  };

  const handleMarkWatched = async (id: number) => {
    if (!isAdmin || !currentUser) return;

    // 1. Optimistic UI update (instantly moves it to the Watched tab for you)
    setMovies(movies.map(m => 
      m.id === id ? { ...m, status: 'watched' } : m
    ));

    // 2. Send PATCH request to Cloudflare to permanently save the change
    try {
      await fetch('/api/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId: id,
          username: currentUser
        })
      });
    } catch (error) {
      console.error("Failed to mark as watched:", error);
    }
  };

  const handleDeleteMovie = async (id: number) => {
    if (!isAdmin || !currentUser) return;
    
    const confirmDelete = window.confirm("Are you sure you want to delete this movie entirely?");
    if (!confirmDelete) return;

    // 1. Optimistic UI update
    setMovies(movies.filter(m => m.id !== id));

    // 2. Send DELETE request to Cloudflare
    try {
      await fetch('/api/movies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId: id,
          username: currentUser
        })
      });
    } catch (error) {
      console.error("Failed to delete movie:", error);
    }
  };

  // --- LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', fontFamily: 'sans-serif', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2 style={{ textAlign: 'center' }}>Movie Night Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <select 
            value={selectedName} 
            onChange={(e) => {
              setSelectedName(e.target.value);
              setPin('');
              setLoginError('');
            }}
            style={{ padding: '10px' }}
          >
            {USERS.map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          {selectedName === 'James' && (
            <input 
              type="password" 
              placeholder="Enter PIN" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ padding: '10px' }}
            />
          )}

          {loginError && <p style={{ color: 'red', margin: 0 }}>{loginError}</p>}
          
          <button type="submit" style={{ padding: '10px', background: '#333', color: 'white', border: 'none', borderRadius: '5px' }}>
            Enter
          </button>
        </form>
      </div>
    );
  }

  // --- MAIN APP SCREEN ---
  const displayedMovies = movies.filter(m => m.status === activeTab);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}><Film /> Movie Night</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span>Hey, <strong>{currentUser}</strong> {isAdmin && '(Admin)'}</span>
          <button onClick={() => setCurrentUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('watchlist')}
          style={{ flex: 1, padding: '10px', background: activeTab === 'watchlist' ? '#333' : '#eee', color: activeTab === 'watchlist' ? 'white' : 'black', border: 'none', borderRadius: '5px' }}
        >
          Watchlist
        </button>
        <button 
          onClick={() => setActiveTab('watched')}
          style={{ flex: 1, padding: '10px', background: activeTab === 'watched' ? '#333' : '#eee', color: activeTab === 'watched' ? 'white' : 'black', border: 'none', borderRadius: '5px' }}
        >
          Watched
        </button>
      </div>

      {activeTab === 'watchlist' && (
        <form onSubmit={handleAddMovie} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Movie Title" 
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 2, padding: '10px' }}
          />
          <input 
            type="text" 
            placeholder="Image URL (optional)" 
            value={newImage}
            onChange={(e) => setNewImage(e.target.value)}
            style={{ flex: 2, padding: '10px' }}
          />
          <button type="submit" style={{ padding: '10px', background: 'blue', color: 'white', border: 'none', borderRadius: '5px' }}>Add</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {displayedMovies.length === 0 && <p>No movies here yet!</p>}
        
        {displayedMovies.map(movie => (
          <div key={movie.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', gap: '15px' }}>
            {movie.image_url ? (
              <img src={movie.image_url} alt={movie.title} style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
            ) : (
              <div style={{ width: '60px', height: '90px', background: '#eee', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No img</div>
            )}
            
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 5px 0' }}>{movie.title}</h3>
              
              {/* Watchlist View */}
              {movie.status === 'watchlist' && (
                <p style={{ margin: 0, color: '#666', fontWeight: 'bold' }}>Votes: {movie.votes}</p>
              )}

              {/* Watched View */}
              {movie.status === 'watched' && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}>
                    Group Avg: <Star size={14} style={{ display: 'inline', marginBottom: '-2px' }}/> {movie.avgRating || 'Unrated'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '0.8rem' }}>Your rating:</span>
                      <select 
                        value={movie.userRating || ''} 
                        onChange={(e) => handleRate(movie.id, Number(e.target.value))}
                        style={{ padding: '2px 5px' }}
                      >
                        <option value="" disabled>-</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>
                    
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteMovie(movie.id)} 
                        style={{ padding: '4px 8px', background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Watchlist Actions */}
            {movie.status === 'watchlist' && (
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    onClick={() => handleVote(movie.id, 1)} 
                    style={{ padding: '5px', cursor: 'pointer', background: movie.userVote === 1 ? '#d4edda' : 'white', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <ThumbsUp size={18} color={movie.userVote === 1 ? 'green' : 'black'} />
                  </button>
                  <button 
                    onClick={() => handleVote(movie.id, -1)} 
                    style={{ padding: '5px', cursor: 'pointer', background: movie.userVote === -1 ? '#f8d7da' : 'white', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <ThumbsDown size={18} color={movie.userVote === -1 ? 'red' : 'black'} />
                  </button>
                </div>
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => handleMarkWatched(movie.id)} 
                      style={{ padding: '5px', background: 'green', color: 'white', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                    >
                      <Check size={16} /> Watched
                    </button>
                    <button 
                      onClick={() => handleDeleteMovie(movie.id)} 
                      style={{ padding: '5px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </  >
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}