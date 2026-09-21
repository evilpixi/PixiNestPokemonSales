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

const SALE_BASE = '/sale';
const buyDialog = document.getElementById('buy-dialog');
const buyForm = document.getElementById('buy-form');
const buyTitle = document.getElementById('buy-title');
const buyPokemonIdInput = document.getElementById('buy-pokemon-id');
const buyClientInput = document.getElementById('buy-client');
const buyAddressInput = document.getElementById('buy-address');
const buySubmitBtn = document.getElementById('buy-submit-btn');
const buyCancelBtn = document.getElementById('buy-cancel-btn');
const buyError = document.getElementById('buy-error');
const checkoutBanner = document.getElementById('checkout-banner');

let currentFilter = 'all';
let currentPokemons = [];

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
    currentPokemons = await fetchPokemons();
    renderPokemons(currentPokemons);
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
    const pokemon = currentPokemons.find((p) => p.id === Number(id));
    if (pokemon) openBuyDialog(pokemon);
  }
}

function openBuyDialog(pokemon) {
  buyForm.reset();
  buyError.hidden = true;
  buyPokemonIdInput.value = pokemon.id;
  buyTitle.textContent = `Comprar ${pokemon.name} ($${Number(pokemon.price).toFixed(2)})`;
  buyDialog.showModal();
}

// Creates the sale on the backend and sends the buyer to Stripe's hosted checkout.
// The pokemon is only marked as sold later, when Stripe confirms the payment via webhook.
async function handleBuySubmit(event) {
  event.preventDefault();
  buyError.hidden = true;
  buySubmitBtn.disabled = true;

  try {
    const res = await fetch(SALE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: buyClientInput.value.trim(),
        address: buyAddressInput.value.trim(),
        productId: Number(buyPokemonIdInput.value),
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'No se pudo iniciar el pago');
    if (!body.url) throw new Error('El servidor no devolvio la URL de pago');

    window.location.href = body.url;
  } catch (err) {
    buyError.textContent = err.message;
    buyError.hidden = false;
    buySubmitBtn.disabled = false;
  }
}

// Stripe sends the buyer back to /app/?checkout=success|cancel (see SaleController).
function showCheckoutResult() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('checkout');
  if (result !== 'success' && result !== 'cancel') return;

  checkoutBanner.className = `banner ${result}`;
  checkoutBanner.textContent =
    result === 'success'
      ? 'Pago recibido. El pokemon pasa a "Vendido" apenas Stripe confirme el pago.'
      : 'Pago cancelado. No se realizo ningun cobro.';
  checkoutBanner.hidden = false;
  window.history.replaceState(null, '', window.location.pathname);

  // The webhook is asynchronous: it can arrive a moment after the redirect, so refresh a few times.
  if (result === 'success') {
    let refreshes = 0;
    const timer = setInterval(() => {
      loadPokemons();
      if (++refreshes >= 5) clearInterval(timer);
    }, 2000);
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
buyForm.addEventListener('submit', handleBuySubmit);
buyCancelBtn.addEventListener('click', () => buyDialog.close());

showCheckoutResult();
loadPokemons();
