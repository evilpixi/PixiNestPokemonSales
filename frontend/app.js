const API_BASE = '/pokemon';

const form = document.getElementById('pokemon-form');
const formTitle = document.getElementById('form-title');
const idInput = document.getElementById('pokemon-id');
const nameInput = document.getElementById('pokemon-name');
const levelInput = document.getElementById('pokemon-level');
const priceInput = document.getElementById('pokemon-price');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formError = document.getElementById('form-error');
const tbody = document.getElementById('pokemon-tbody');
const emptyState = document.getElementById('empty-state');
const filterButtons = document.querySelectorAll('.filter-btn');

let currentFilter = 'all';

function endpointForFilter(filter) {
  if (filter === 'available') return `${API_BASE}/available`;
  if (filter === 'sold') return `${API_BASE}/sold`;
  return API_BASE;
}

async function fetchPokemons() {
  const res = await fetch(endpointForFilter(currentFilter));
  if (!res.ok) throw new Error('No se pudo obtener la lista de pokemons');
  return res.json();
}

function renderPokemons(pokemons) {
  tbody.innerHTML = '';
  emptyState.hidden = pokemons.length > 0;

  for (const pokemon of pokemons) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${pokemon.id}</td>
      <td>${escapeHtml(pokemon.name)}</td>
      <td>${pokemon.level}</td>
      <td>$${Number(pokemon.price).toFixed(2)}</td>
      <td><span class="badge ${pokemon.sold ? 'sold' : 'available'}">${pokemon.sold ? 'Vendido' : 'Disponible'}</span></td>
      <td class="row-actions">
        <button class="secondary" data-action="edit" data-id="${pokemon.id}">Editar</button>
        ${pokemon.sold ? '' : `<button data-action="buy" data-id="${pokemon.id}">Comprar</button>`}
      </td>
    `;

    tbody.appendChild(tr);
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

async function loadPokemons() {
  try {
    const pokemons = await fetchPokemons();
    renderPokemons(pokemons);
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'Agregar pokemon';
  submitBtn.textContent = 'Agregar';
  cancelEditBtn.hidden = true;
  formError.hidden = true;
}

function enterEditMode(pokemon) {
  idInput.value = pokemon.id;
  nameInput.value = pokemon.name;
  levelInput.value = pokemon.level;
  priceInput.value = pokemon.price;
  formTitle.textContent = `Editar pokemon #${pokemon.id}`;
  submitBtn.textContent = 'Guardar cambios';
  cancelEditBtn.hidden = false;
  formError.hidden = true;
}

async function handleSubmit(event) {
  event.preventDefault();
  formError.hidden = true;

  const payload = {
    name: nameInput.value.trim(),
    level: Number(levelInput.value),
    price: Number(priceInput.value),
  };

  const editingId = idInput.value;
  const url = editingId ? `${API_BASE}/${editingId}` : API_BASE;
  const method = editingId ? 'PATCH' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'No se pudo guardar el pokemon');
    }

    resetForm();
    await loadPokemons();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
}

async function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === 'edit') {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) return;
    const pokemon = await res.json();
    enterEditMode(pokemon);
    return;
  }

  if (action === 'buy') {
    const res = await fetch(`${API_BASE}/${id}/buy`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      formError.textContent = body.message || 'No se pudo comprar el pokemon';
      formError.hidden = false;
      return;
    }
    await loadPokemons();
  }
}

function handleFilterClick(event) {
  const button = event.target.closest('.filter-btn');
  if (!button) return;

  currentFilter = button.dataset.filter;
  filterButtons.forEach(btn => btn.classList.toggle('active', btn === button));
  loadPokemons();
}

form.addEventListener('submit', handleSubmit);
cancelEditBtn.addEventListener('click', resetForm);
tbody.addEventListener('click', handleTableClick);
filterButtons.forEach(btn => btn.addEventListener('click', handleFilterClick));

loadPokemons();
