// ===========================
// MOVIES DATA
// ===========================
const movies = [
  {
    title: "Aaro",
    poster: "Aaro.",
    video: "https://www.youtube.com/embed/v9jqDP7U8b8?si=GXxLEIJYgOorr8u5"
  },
  {
    title: "Mareechika",
    poster: "Jk.",
    video: "https://www.youtube.com/embed/Bj6YTLGktnY?si=4jK9ERCVw1Zr_SzZ"
  },
  {
    title: "Valayam",
    poster: "Valayam.",
    video: "https://www.youtube.com/embed/2dI2DTsX3Ek?si=lJsssgtjDt8RShhI"
  },
  {
    title: "Maruvasham",
    poster: "Maruvasham.",
    video: "https://www.youtube.com/embed/OthoLwGgY6o?si=wQPP7Muvs6PMs9JG"
  }
];

// ===========================
// OPEN MOVIE (SAFE)
// ===========================
function openMovie(title) {
  window.location.href = "watch.html?movie=" + encodeURIComponent(title);
}

// ===========================
// HOME PAGE RENDER (Netflix Card Style)
// ===========================
const movieContainer = document.getElementById("movie-container");

if (movieContainer) {
  movieContainer.innerHTML = "";

  movies.forEach(movie => {
    movieContainer.innerHTML += `
      <div class="movie-card" onclick="openMovie('${movie.title}')">
        <div class="poster-wrapper">
          <img src="${movie.poster}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster';">
          <div class="play-overlay">▶</div>
        </div>
        <div class="movie-details">
          <h3 class="movie-title">${movie.title}</h3>
        </div>
      </div>
    `;
  });
}

// ===========================
// SEARCH MOVIE (SAFE)
// ===========================
function searchMovie() {
  const input = document.getElementById("searchBox");

  if (!input) return;

  let value = input.value.trim().toLowerCase();

  if (value === "") {
    alert("Please enter a movie name!");
    return;
  }

  const movie = movies.find(
    m => m.title.toLowerCase() === value
  );

  if (movie) {
    window.location.href = "watch.html?movie=" + encodeURIComponent(movie.title);
  } else {
    alert("Movie not found!");
  }
}

// ===========================
// WATCH PAGE (SAFE + NO CRASH)
// ===========================
const player = document.getElementById("player");

if (player) {
  const params = new URLSearchParams(window.location.search);
  let movieName = params.get("movie");

  if (!movieName) {
    movieName = localStorage.getItem("movie");
  }

  const movie = movies.find(
    m => m.title.toLowerCase() === (movieName || "").toLowerCase()
  );

  if (movie) {
    player.src = movie.video;
  } else {
    console.warn("Movie not found!");
    window.location.href = "movie.html";
  }
}
