import React, { useState, useEffect } from 'react';
import './App.css';
import { ThumbsUp, ThumbsDown, Check, Film, Star, LogOut, Trash2 } from 'lucide-react';
interface Movie {
  id: number;
  title: string;
  image_url: string;
  status: 'watchlist' | 'watched';
  votes: number;
  upvotes: number;
  downvotes: number;
  userVote?: number; // 1 for upvote, -1 for downvote, 0 for none
  userRating?: number; // 1-10
  avgRating?: number;
}

const USERS = [
  'Asher', 'Ben', 'Burtt', 'Call', 'Carson', 'Carter', 'China', 'Colsen', 'Crint',
  'Eli', 'Isaac E.', 'Jake', 'James', 'Josh', 'Kaiden','Luke', 'Malachi', 'McCants', 
  'Micah', 'Nolan', 'Owen', 'Sam', 'Tyler', 'Weindel'
];
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
    
    // 1. Enforce both title and image exist
    if (!newTitle.trim() || !newImage.trim() || !currentUser) {
      alert("Please provide both a movie title and an image URL.");
      return;
    }

    // 2. Check for duplicates (case-insensitive)
    const isDuplicate = movies.some(
      m => m.title.toLowerCase() === newTitle.trim().toLowerCase()
    );

    if (isDuplicate) {
      alert("A movie with this title is already on the list!");
      return;
    }

    // 3. Optimistic UI update
    const tempMovie: Movie = {
      id: Date.now(), 
      title: newTitle.trim(),
      image_url: newImage.trim(),
      status: 'watchlist',
      votes: 0,
      upvotes: 0,
      downvotes: 0,
      userVote: 0
    };
    
    setMovies([...movies, tempMovie].sort((a, b) => (b.votes || 0) - (a.votes || 0)));
    setNewTitle('');
    setNewImage('');

    // 4. Send the POST request
    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tempMovie.title,
          image_url: tempMovie.image_url,
          username: currentUser
        })
      });
      
      if (!response.ok) {
        console.error("Failed to add to database, status:", response.status);
        // Optional: You could remove the optimistic tempMovie here if the DB fails
      } else {
        fetchMovies(); 
      }
    } catch (error) {
      console.error("Failed to add movie:", error);
    }
  };

  const handleVote = async (id: number, increment: number) => {
    let targetVote = increment;

    setMovies(movies.map(m => {
      if (m.id === id) {
        const oldVote = m.userVote || 0;
        if (oldVote === increment) targetVote = 0; // Unvoting
        
        let newUpvotes = m.upvotes || 0;
        let newDownvotes = m.downvotes || 0;

        // Remove old vote logic
        if (oldVote === 1) newUpvotes -= 1;
        if (oldVote === -1) newDownvotes -= 1;

        // Add new target vote logic
        if (targetVote === 1) newUpvotes += 1;
        if (targetVote === -1) newDownvotes += 1;

        const newTotal = m.votes - oldVote + targetVote;

        return { 
          ...m, 
          votes: newTotal, 
          userVote: targetVote,
          upvotes: newUpvotes,
          downvotes: newDownvotes
        };
      }
      return m;
    }).sort((a, b) => b.votes - a.votes));

    // 2. Send the actual request to Cloudflare with the calculated targetVote
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId: id,
          username: currentUser,
          voteDir: targetVote
        })
      });
    } catch (error) {
      console.error("Vote failed:", error);
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
          
          <button type="submit" className="login-btn">
            Enter
          </button>
        </form>
      </div>
    );
  }

  // --- MAIN APP SCREEN ---
  const displayedMovies = movies.filter(m => m.status === activeTab);
  return (
    <div className="app-container">
      <header className="app-header">
        <h1><Film /> Movie Night</h1>
        <div className="user-info">
          <span>Hey, <strong>{currentUser}</strong> {isAdmin && '(Admin)'}</span>
          <button onClick={() => setCurrentUser(null)} className="logout-btn" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="tab-container">
        <button 
          onClick={() => setActiveTab('watchlist')}
          className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`}
        >
          Watchlist
        </button>
        <button 
          onClick={() => setActiveTab('watched')}
          className={`tab-btn ${activeTab === 'watched' ? 'active' : ''}`}
        >
          Watched
        </button>
      </div>


      {activeTab === 'watchlist' && (
        <form onSubmit={handleAddMovie} className="add-movie-form">
          <input 
            type="text" 
            placeholder="Movie Title" 
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="dark-input"
            style={{ flex: 1 }}
            required
          />
          <input 
            type="text" 
            placeholder="Image URL" 
            value={newImage}
            onChange={(e) => setNewImage(e.target.value)}
            className="dark-input"
            style={{ flex: 1 }}
            required
          />
          <button type="submit" className="add-btn">Add Movie</button>
        </form>
      )}

      <div className="movie-grid">
        {displayedMovies.length === 0 && <p style={{ color: '#888' }}>No movies here yet!</p>}
        
        {displayedMovies.map(movie => (
          <div key={movie.id} className="movie-card">
            {movie.image_url ? (
              <img src={movie.image_url} alt={movie.title} className="movie-image" />
            ) : (
              <div className="movie-image empty-image">
                <Film size={48} color="#555" />
              </div>
            )}
            
            <div className="movie-content">
              <h3 className="movie-title">{movie.title}</h3>
              
              {/* Watchlist Actions */}
              {movie.status === 'watchlist' && (
                <div className="vote-container">
                  <button 
                    onClick={() => handleVote(movie.id, 1)} 
                    className={`vote-btn ${movie.userVote === 1 ? 'active-up' : ''}`}
                  >
                    <ThumbsUp size={18} /> {movie.upvotes || 0}
                  </button>
                  <button 
                    onClick={() => handleVote(movie.id, -1)} 
                    className={`vote-btn ${movie.userVote === -1 ? 'active-down' : ''}`}
                  >
                    <ThumbsDown size={18} /> {movie.downvotes || 0}
                  </button>
                  
                  {isAdmin && (
                    <div className="admin-controls">
                      <button onClick={() => handleMarkWatched(movie.id)} className="admin-btn success" title="Mark Watched">
                        <Check size={18} />
                      </button>
                      <button onClick={() => handleDeleteMovie(movie.id)} className="admin-btn danger" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Watched Actions */}
              {movie.status === 'watched' && (
                <div className="watched-controls">
                  <p className="group-avg">
                    Group Avg: <Star size={14} style={{ display: 'inline', marginBottom: '-2px', color: '#fbbf24' }}/> {movie.avgRating || 'Unrated'}
                  </p>
                  <div className="rating-row">
                    <div className="user-rating-select">
                      <span>Your rating:</span>
                      <select 
                        value={movie.userRating || ''} 
                        onChange={(e) => handleRate(movie.id, Number(e.target.value))}
                        className="dark-input"
                        style={{ padding: '6px' }}
                      >
                        <option value="" disabled>-</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>
                    
                    {isAdmin && (
                      <button onClick={() => handleDeleteMovie(movie.id)} className="admin-btn danger-outline" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}