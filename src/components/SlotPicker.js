import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Star, Dice6, TrendingUp, Heart, RefreshCw, ExternalLink, Grid3x3, Ticket } from 'lucide-react';
import SlotMachineWheel from './SlotMachineWheel';

export default function SlotPicker() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [selectedVolatility, setSelectedVolatility] = useState('all');
  const [selectedRTP, setSelectedRTP] = useState('all');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('slot_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [randomPick, setRandomPick] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'wheel'

  // Load games on mount (This would be your API call)
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setGames(mockGameData);
      setLoading(false);
    }, 500);
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('slot_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Get unique providers
  const providers = useMemo(() => {
    const providerSet = new Set(games.map(game => game.provider));
    return Array.from(providerSet).sort();
  }, [games]);

  // Filter games
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           game.provider.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvider = selectedProviders.length === 0 || selectedProviders.includes(game.provider);
      const matchesVolatility = selectedVolatility === 'all' || game.volatility === selectedVolatility;
      const matchesRTP = selectedRTP === 'all' ||
                        (selectedRTP === 'high' && game.rtp >= 96) ||
                        (selectedRTP === 'medium' && game.rtp >= 94 && game.rtp < 96) ||
                        (selectedRTP === 'low' && game.rtp < 94);

      return matchesSearch && matchesProvider && matchesVolatility && matchesRTP;
    });
  }, [games, searchTerm, selectedProviders, selectedVolatility, selectedRTP]);

  const toggleProvider = (provider) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const toggleFavorite = (gameId) => {
    setFavorites(prev =>
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const pickRandom = () => {
    if (filteredGames.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredGames.length);
      setRandomPick(filteredGames[randomIndex]);
      // Scroll to top to show the pick
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearRandomPick = () => {
    setRandomPick(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-emerald-400" size={40} />
          <p className="text-white/60">Loading slots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Random Pick Display */}
      {randomPick && (
        <div className="p-6 bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border-2 border-emerald-500/50 rounded-xl backdrop-blur-sm animate-pulse">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-emerald-400 font-bold text-sm uppercase tracking-wider mb-2">
                Random Pick
              </p>
              <h3 className="text-3xl font-black text-white mb-1">{randomPick.name}</h3>
              <p className="text-white/70">{randomPick.provider}</p>
            </div>
            <button
              onClick={clearRandomPick}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
              RTP: {randomPick.rtp}%
            </span>
            <span className="px-3 py-1 bg-white/10 rounded-full text-sm capitalize">
              {randomPick.volatility} Volatility
            </span>
            {randomPick.maxWin && (
              <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-sm text-emerald-300">
                Max Win: {randomPick.maxWin}x
              </span>
            )}
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex justify-center gap-2 p-1 bg-white/5 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setViewMode('grid')}
          className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
            viewMode === 'grid'
              ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Grid3x3 size={18} />
          Grid View
        </button>
        <button
          onClick={() => setViewMode('wheel')}
          className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
            viewMode === 'wheel'
              ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Ticket size={18} />
          Wheel View
        </button>
      </div>

      {/* Search and Actions Bar - Only show in grid view */}
      {viewMode === 'grid' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
            <input
              type="text"
              placeholder="Search slots or providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${
              showFilters
                ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Filter size={18} />
            Filters
          </button>
          <button
            onClick={pickRandom}
            disabled={filteredGames.length === 0}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Dice6 size={18} />
            Random Pick
          </button>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-6 bg-white/5 border border-white/10 rounded-xl space-y-6">
          {/* Provider Filters */}
          <div>
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">
              Providers ({selectedProviders.length} selected)
            </h3>
            <div className="flex flex-wrap gap-2">
              {providers.map(provider => (
                <button
                  key={provider}
                  onClick={() => toggleProvider(provider)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    selectedProviders.includes(provider)
                      ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>

          {/* Volatility Filter */}
          <div>
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">Volatility</h3>
            <div className="flex flex-wrap gap-2">
              {['all', 'low', 'medium', 'high'].map(vol => (
                <button
                  key={vol}
                  onClick={() => setSelectedVolatility(vol)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                    selectedVolatility === vol
                      ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {vol}
                </button>
              ))}
            </div>
          </div>

          {/* RTP Filter */}
          <div>
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">RTP Range</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'high', label: 'High (96%+)' },
                { value: 'medium', label: 'Medium (94-96%)' },
                { value: 'low', label: 'Low (<94%)' },
              ].map(rtp => (
                <button
                  key={rtp.value}
                  onClick={() => setSelectedRTP(rtp.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    selectedRTP === rtp.value
                      ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {rtp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Wheel View */}
      {viewMode === 'wheel' && <SlotMachineWheel games={filteredGames} />}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>{filteredGames.length} slots found</span>
            {favorites.length > 0 && (
              <span className="flex items-center gap-1">
                <Heart size={14} className="text-pink-400" />
                {favorites.length} favorites
              </span>
            )}
          </div>

          {/* Game Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map(game => (
              <div
                key={game.id}
                className="group p-4 bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-xl hover:border-emerald-400/60 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1 line-clamp-1">{game.name}</h3>
                    <p className="text-sm text-white/60">{game.provider}</p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(game.id)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <Heart
                      size={18}
                      className={favorites.includes(game.id) ? 'fill-pink-400 text-pink-400' : 'text-white/40'}
                    />
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap mb-3">
                  <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs font-bold text-emerald-300">
                    {game.rtp}% RTP
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${
                    game.volatility === 'high'
                      ? 'bg-red-500/20 border border-red-500/30 text-red-300'
                      : game.volatility === 'medium'
                      ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-300'
                      : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                  }`}>
                    {game.volatility}
                  </span>
                  {game.maxWin && (
                    <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs font-bold text-purple-300">
                      {game.maxWin}x
                    </span>
                  )}
                </div>

                {game.features && game.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {game.features.slice(0, 3).map((feature, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-xs text-white/50">
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setRandomPick(game)}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border border-emerald-500/30 text-white font-bold hover:from-emerald-500/30 hover:to-purple-500/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                >
                  <Star size={16} />
                  Select This
                </button>
              </div>
            ))}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center py-20">
              <p className="text-white/60 text-lg">No slots match your filters</p>
              <p className="text-white/40 text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Mock game data - Replace this with real API call
const mockGameData = [
  // Pragmatic Play
  { id: 1, name: 'Sweet Bonanza', provider: 'Pragmatic Play', rtp: 96.51, volatility: 'high', maxWin: 21100, features: ['Tumble', 'Free Spins', 'Multipliers'] },
  { id: 2, name: 'Gates of Olympus', provider: 'Pragmatic Play', rtp: 96.50, volatility: 'high', maxWin: 5000, features: ['Tumble', 'Free Spins', 'Multipliers'] },
  { id: 3, name: 'The Dog House', provider: 'Pragmatic Play', rtp: 96.51, volatility: 'high', maxWin: 6750, features: ['Sticky Wilds', 'Free Spins'] },
  { id: 4, name: 'Sugar Rush', provider: 'Pragmatic Play', rtp: 96.50, volatility: 'high', maxWin: 5000, features: ['Cluster Pays', 'Multipliers'] },
  { id: 5, name: 'Starlight Princess', provider: 'Pragmatic Play', rtp: 96.50, volatility: 'high', maxWin: 5000, features: ['Tumble', 'Multipliers'] },

  // Play'n GO
  { id: 6, name: 'Book of Dead', provider: 'Play\'n GO', rtp: 96.21, volatility: 'high', maxWin: 5000, features: ['Expanding Symbols', 'Free Spins'] },
  { id: 7, name: 'Reactoonz', provider: 'Play\'n GO', rtp: 96.51, volatility: 'high', maxWin: 4570, features: ['Cluster Pays', 'Quantum Features'] },
  { id: 8, name: 'Moon Princess', provider: 'Play\'n GO', rtp: 96.50, volatility: 'high', maxWin: 5000, features: ['Cascade', 'Girl Power'] },
  { id: 9, name: 'Fire Joker', provider: 'Play\'n GO', rtp: 96.15, volatility: 'medium', maxWin: 800, features: ['Wheel of Multipliers'] },
  { id: 10, name: 'Rise of Olympus', provider: 'Play\'n GO', rtp: 96.50, volatility: 'high', maxWin: 5000, features: ['Cascade', 'God Powers'] },

  // NetEnt
  { id: 11, name: 'Starburst', provider: 'NetEnt', rtp: 96.09, volatility: 'low', maxWin: 500, features: ['Expanding Wilds', 'Re-Spins'] },
  { id: 12, name: 'Gonzo\'s Quest', provider: 'NetEnt', rtp: 95.97, volatility: 'medium', maxWin: 2500, features: ['Avalanche', 'Multipliers'] },
  { id: 13, name: 'Dead or Alive 2', provider: 'NetEnt', rtp: 96.80, volatility: 'high', maxWin: 111111, features: ['Sticky Wilds', 'Free Spins'] },
  { id: 14, name: 'Blood Suckers', provider: 'NetEnt', rtp: 98.00, volatility: 'low', maxWin: 900, features: ['Free Spins', 'Bonus Game'] },
  { id: 15, name: 'Divine Fortune', provider: 'NetEnt', rtp: 96.59, volatility: 'medium', maxWin: 0, features: ['Jackpot', 'Free Spins'] },

  // Nolimit City
  { id: 16, name: 'Tombstone RIP', provider: 'Nolimit City', rtp: 96.08, volatility: 'high', maxWin: 300000, features: ['xNudge', 'xWays'] },
  { id: 17, name: 'San Quentin xWays', provider: 'Nolimit City', rtp: 96.03, volatility: 'high', maxWin: 150000, features: ['xWays', 'Split Symbols'] },
  { id: 18, name: 'Mental', provider: 'Nolimit City', rtp: 96.06, volatility: 'high', maxWin: 66666, features: ['xNudge', 'Fire Frame'] },
  { id: 19, name: 'Fire in the Hole', provider: 'Nolimit City', rtp: 96.06, volatility: 'high', maxWin: 60000, features: ['xBomb', 'Collapsing Symbols'] },
  { id: 20, name: 'Das xBoot', provider: 'Nolimit City', rtp: 96.03, volatility: 'high', maxWin: 55200, features: ['xWays', 'Collapsing Symbols'] },

  // Hacksaw Gaming
  { id: 21, name: 'Wanted Dead or a Wild', provider: 'Hacksaw Gaming', rtp: 96.38, volatility: 'high', maxWin: 12500, features: ['Sticky Wilds', 'Duel at Dawn'] },
  { id: 22, name: 'Chaos Crew', provider: 'Hacksaw Gaming', rtp: 96.30, volatility: 'high', maxWin: 10000, features: ['Mystery Symbols', 'Free Spins'] },
  { id: 23, name: 'RIP City', provider: 'Hacksaw Gaming', rtp: 96.20, volatility: 'high', maxWin: 10000, features: ['Payout Multiplier', 'Wild Hunt'] },
  { id: 24, name: 'Le Bandit', provider: 'Hacksaw Gaming', rtp: 96.32, volatility: 'high', maxWin: 10000, features: ['Walking Wilds', 'Walking Wild Multiplier'] },
  { id: 25, name: 'Cubes 2', provider: 'Hacksaw Gaming', rtp: 96.37, volatility: 'high', maxWin: 5000, features: ['Cluster Pays', 'Multipliers'] },

  // Relax Gaming
  { id: 26, name: 'Money Train 2', provider: 'Relax Gaming', rtp: 96.40, volatility: 'high', maxWin: 50000, features: ['Bonus Game', 'Persistent Symbols'] },
  { id: 27, name: 'Money Train 3', provider: 'Relax Gaming', rtp: 96.10, volatility: 'high', maxWin: 100000, features: ['Bonus Game', 'Persistent Symbols'] },
  { id: 28, name: 'Snake Arena', provider: 'Relax Gaming', rtp: 96.23, volatility: 'high', maxWin: 5814, features: ['Snake Spins', 'Bonus Game'] },
  { id: 29, name: 'Templar Tumble', provider: 'Relax Gaming', rtp: 96.25, volatility: 'high', maxWin: 15000, features: ['Tumble', 'Mystery Symbols'] },
  { id: 30, name: 'TNT Tumble', provider: 'Relax Gaming', rtp: 96.30, volatility: 'high', maxWin: 46656, features: ['Tumble', 'Expanding Grid'] },
];