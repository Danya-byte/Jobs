<template>
<div class="container" @click="handleClickOutside">
    <nav class="nav-bar">
        <RouterLink :to="{ path: `/profile/${currentUserId}`, query: { username: currentUsername } }" class="profile-link">
            <img :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'" class="profile-icon" loading="lazy">
            <div class="user-name" v-if="userFirstName || userLastName">
                <span class="first-name">{{ userFirstName }}</span>
            </div>
        </RouterLink>
        <button v-if="isAdmin" @click="showAddJobModal" class="add-button"><span></span> Add Jobs</button>
        <button v-if="isAdmin" @click="showAddVacancyModal" class="add-button"><span></span> Add Vacancy</button>
        <a v-else href="https://t.me/workiks_admin" class="add-button"><span></span> Add Jobs</a>
    </nav>

    <div class="content">
        <div class="categories">
            <button class="category-btn" :class="{ active: activeTab === 'jobs' }" @click="activeTab = 'jobs'">Jobs</button>
            <button class="category-btn" :class="{ active: activeTab === 'companies' }" @click="activeTab = 'companies'">Companies</button>
            <RouterLink to="/nft"><button class="category-btn" :class="{ active: activeTab === 'nft' }" @click="activeTab = 'nft'">NFT</button></RouterLink>
        </div>

        <div class="search-and-filter">
            <div class="search-container">
                <input v-model="searchQuery" type="text" placeholder="Search by position..." class="search-input" ref="searchInput">
            </div>
            <button class="filter-icon" @click="toggleFilterModal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#97f492" stroke-width="2">
                    <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z"/>
                </svg>
            </button>
        </div>

        <div class="selected-filters" v-if="selectedCategories.length > 0">
            <span v-for="cat in selectedCategories" class="filter-pill">
                {{ categories.find(c => c.value === cat).label }}
                <button @click="selectedCategories = selectedCategories.filter(c => c !== cat)">×</button>
            </span>
        </div>

        <div class="jobs-scroll-container">
            <div class="jobs-list" v-if="activeTab === 'jobs'">
                <div v-if="isLoading" class="skeleton-container">
                    <div class="skeleton-card" v-for="n in 3" :key="n"></div>
                </div>
                <button v-else @click="showJobDetails(job)" class="job-card" v-for="job in filteredJobs" :key="job.id">
                    <div class="card-header">
                        <img class="job-icon" src="https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp" loading="lazy">
                        <div class="job-info">
                            <p class="nick">{{ job.nick }}</p>
                            <p class="work">{{ job.position }}</p>
                            <p class="experience">{{ job.experience ? `${job.experience} years experience` : 'No experience specified' }}</p>
                        </div>
                    </div>
                    <p class="job-description">{{ job.description }}</p>
                    <div class="tags">
                        <span v-for="(tag, i) in job.tags" :key="i" class="tag">{{ tag }}</span>
                    </div>
                    <span v-if="isNew(job)" class="new-label">new</span>
                </button>
            </div>
            <div class="jobs-list" v-if="activeTab === 'companies'">
                <div v-if="isLoading" class="skeleton-container">
                    <div class="skeleton-card" v-for="n in 3" :key="n"></div>
                </div>
                <button v-else @click="showVacancyDetails(vacancy)" class="job-card" v-for="vacancy in filteredVacancies" :key="vacancy.id">
                    <div class="card-header">
                        <img :src="vacancy.photoUrl" class="job-icon" loading="lazy" @error="handleImageError">
                        <div class="job-info">
                            <p class="nick">{{ vacancy.companyName }} <span v-if="vacancy.verified" class="verified-badge">✔</span></p>
                            <p class="work">{{ vacancy.position }}</p>
                            <p class="experience">{{ vacancy.description.slice(0, 50) + '...' }}</p>
                        </div>
                    </div>
                    <div class="tags">
                        <span v-for="(tag, i) in vacancy.tags" :key="i" class="tag">{{ tag }}</span>
                    </div>
                    <span v-if="isNew(vacancy)" class="new-label">new</span>
                </button>
            </div>
        </div>

        <transition name="fade">
            <div v-if="showFilterModal" class="filter-modal-overlay" @click.self="showFilterModal = false">
                <div class="filter-modal">
                    <h3>Filters</h3>
                    <div class="filter-section">
                        <h4>Categories</h4>
                        <label v-for="category in categories" :key="category.value" class="checkbox-label">
                            <input type="checkbox" v-model="selectedCategories" :value="category.value">
                            {{ category.label }}
                        </label>
                    </div>
                    <div class="filter-section">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="showFavoritesOnly">
                            Show Favorites Only
                        </label>
                    </div>
                    <button @click="showFilterModal = false" class="apply-btn">Apply</button>
                </div>
            </div>
        </transition>
    </div>

    <transition name="slide-up">
        <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
            <div class="modal">
                <div class="modal-header">
                    <h2>{{ addMode === 'job' ? 'Add New Job' : 'Add New Vacancy' }}</h2>
                    <button class="close-btn" @click="showAddModal = false">×</button>
                </div>
                <div class="job-details">
                    <input v-if="addMode === 'vacancy'" v-model="newItem.companyUserId" placeholder="Company User ID (e.g., 1234567890)" class="search-input" type="number" :class="{ 'invalid': !newItem.companyUserId && formSubmitted }">
                    <input v-if="addMode === 'vacancy'" v-model="newItem.companyName" placeholder="Company Name" class="search-input" :class="{ 'invalid': !newItem.companyName && formSubmitted }">
                    <input v-if="addMode === 'job'" v-model="newItem.userId" placeholder="User ID (e.g., 1029594875)" class="search-input" type="number" :class="{ 'invalid': !newItem.userId && formSubmitted }">
                    <input v-if="addMode === 'job'" v-model="newItem.nick" placeholder="Nick" class="search-input" :class="{ 'invalid': !newItem.nick && formSubmitted }">
                    <input v-if="addMode === 'job'" v-model="newItem.username" placeholder="Username (optional)" class="search-input">
                    <input v-model="newItem.position" placeholder="Position" class="search-input" :class="{ 'invalid': !newItem.position && formSubmitted }">
                    <input v-if="addMode === 'job'" v-model="newItem.experience" placeholder="Experience (years)" class="search-input" type="number" min="0">
                    <textarea v-model="newItem.description" placeholder="Description" class="search-input" :class="{ 'invalid': !newItem.description && formSubmitted }"></textarea>
                    <input v-model="requirementsInput" @keyup.enter="addRequirement" placeholder="Requirements (Enter to add)" class="search-input">
                    <ul class="requirements">
                        <li v-for="(req, i) in newItem.requirements" :key="i">
                            {{ req }} <button @click="newItem.requirements.splice(i, 1)" class="delete-req">×</button>
                        </li>
                    </ul>
                    <input v-model="tagsInput" @keyup.enter="addTag" placeholder="Tags (Enter to add)" class="search-input">
                    <div class="tags">
                        <span v-for="(tag, i) in newItem.tags" :key="i" class="tag">
                            {{ tag }} <button @click="newItem.tags.splice(i, 1)" class="delete-tag">×</button>
                        </span>
                    </div>
                    <div class="filter-section">
                        <h4>Categories</h4>
                        <label v-for="category in categories" :key="category.value" class="checkbox-label">
                            <input type="checkbox" v-model="newItem.categories" :value="category.value">
                            {{ category.label }}
                        </label>
                    </div>
                    <input v-model="newItem.contact" placeholder="Contact (e.g., https://t.me/username)" class="search-input" :class="{ 'invalid': !newItem.contact && formSubmitted }">
                    <input v-if="addMode === 'vacancy'" v-model="newItem.officialWebsite" placeholder="Official Website (e.g., https://company.com)" class="search-input" :class="{ 'invalid': !newItem.officialWebsite && formSubmitted }">
                    <input v-if="addMode === 'vacancy'" v-model="newItem.photoUrl" placeholder="Photo URL" class="search-input" :class="{ 'invalid': !newItem.photoUrl && formSubmitted }">
                    <label v-if="addMode === 'vacancy'" class="checkbox-label">
                        <input type="checkbox" v-model="newItem.verified"> Verified
                    </label>
                    <button @click="submitItem" class="contact-btn">Submit</button>
                </div>
            </div>
        </div>
    </transition>

    <transition name="slide-up">
        <div v-if="open" class="modal-overlay" @click.self="open = false">
            <div class="modal">
                <div class="modal-header">
                    <h2>{{ isVacancy ? selectedVacancy.position : selectedJob.position }}</h2>
                    <button class="close-btn" @click="open = false">×</button>
                </div>
                <div class="job-details" v-if="isVacancy">
                    <div class="user-info">
                        <a :href="selectedVacancy.officialWebsite" target="_blank" class="company-link">
                            <img :src="selectedVacancy.photoUrl" class="job-icon" loading="lazy" @error="handleImageError">
                            <div>
                                <p class="nickname">{{ selectedVacancy.companyName }} <span v-if="selectedVacancy.verified" class="verified-badge">✔</span></p>
                            </div>
                        </a>
                        <button class="favorite-btn" @click="toggleFavorite(selectedVacancy.id)">
                            <span :class="{ 'favorite': isFavorite(selectedVacancy.id) }">♥</span>
                        </button>
                    </div>
                    <div class="section">
                        <h3>Description</h3>
                        <p class="description">{{ selectedVacancy.description }}</p>
                    </div>
                    <div class="section">
                        <h3>Requirements</h3>
                        <ul class="requirements">
                            <li v-for="(req, i) in selectedVacancy.requirements" :key="i">{{ req }}</li>
                        </ul>
                    </div>
                    <div class="section">
                        <h3>Skills</h3>
                        <div class="tags">
                            <span v-for="(tag, i) in selectedVacancy.tags" :key="i" class="tag">{{ tag }}</span>
                        </div>
                    </div>
                    <a :href="selectedVacancy.contact" class="contact-btn" target="_blank">Contact via Telegram</a>
                    <button v-if="isAdmin" @click="deleteVacancy(selectedVacancy.id)" class="delete-btn">Delete Vacancy</button>
                </div>
                <div class="job-details" v-else>
                    <div class="user-info">
                        <RouterLink
                            :to="{
                                path: `/profile/${selectedJob.userId}`,
                                query: { username: selectedJob.username }
                            }"
                            class="profile-link"
                        >
                            <img :src="jobIcon" class="job-icon" loading="lazy">
                            <div>
                                <p class="nickname">{{ selectedJob.nick }}</p>
                                <p class="experience">{{ selectedJob.experience ? `${selectedJob.experience} years experience` : 'No experience specified' }}</p>
                            </div>
                        </RouterLink>
                        <button class="favorite-btn" @click="toggleFavorite(selectedJob.id)">
                            <span :class="{ 'favorite': isFavorite(selectedJob.id) }">♥</span>
                        </button>
                    </div>
                    <div class="section">
                        <h3>Description</h3>
                        <p class="description">{{ selectedJob.description }}</p>
                    </div>
                    <div class="section">
                        <h3>Requirements</h3>
                        <ul class="requirements">
                            <li v-for="(req, i) in selectedJob.requirements" :key="i">{{ req }}</li>
                        </ul>
                    </div>
                    <div class="section">
                        <h3>Skills</h3>
                        <div class="tags">
                            <span v-for="(tag, i) in selectedJob.tags" :key="i" class="tag">{{ tag }}</span>
                        </div>
                    </div>
                    <a :href="selectedJob.contact || 'https://t.me/workiks_admin'" class="contact-btn" target="_blank">Contact via Telegram</a>
                    <button v-if="isAdmin" @click="deleteJob(selectedJob.id)" class="delete-btn">Delete Job</button>
                </div>
            </div>
        </div>
    </transition>
</div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

const open = ref(false);
const showAddModal = ref(false);
const showFilterModal = ref(false);
const selectedJob = ref({});
const selectedVacancy = ref({});
const userPhoto = ref('');
const userFirstName = ref('');
const userLastName = ref('');
const currentUserId = ref('');
const currentUsername = ref('');
const isAdmin = ref(false);
const jobIcon = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
const searchQuery = ref('');
const searchInput = ref(null);
const jobs = ref([]);
const vacancies = ref([]);
const isLoading = ref(true);
const favoriteJobs = ref(JSON.parse(localStorage.getItem('favoriteJobs')) || []);
const selectedCategories = ref([]);
const showFavoritesOnly = ref(false);
const activeTab = ref('jobs');
const addMode = ref('job');
const newItem = ref({
    userId: '',
    nick: '',
    username: '',
    position: '',
    experience: null,
    description: '',
    requirements: [],
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin',
    companyUserId: '',
    companyName: '',
    officialWebsite: '',
    verified: false,
    photoUrl: ''
});
const requirementsInput = ref('');
const tagsInput = ref('');
const formSubmitted = ref(false);
const isVacancy = ref(false);

const categories = [
    { label: 'IT', value: 'it' },
    { label: 'Social Media', value: 'social' },
    { label: 'Management', value: 'management' },
    { label: 'Design', value: 'design' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Finance', value: 'finance' }
];

const sortedJobs = computed(() => {
  return [...jobs.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

const filteredJobs = computed(() => {
  let filtered = sortedJobs.value;

  if (selectedCategories.value.length > 0) {
    filtered = filtered.filter(job => {
      if (job.categories && job.categories.length > 0) {
        return job.categories.some(cat => selectedCategories.value.includes(cat));
      }
      return false;
    });
  }

  if (showFavoritesOnly.value) {
    filtered = filtered.filter(job => isFavorite(job.id));
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(job => job.position.toLowerCase().includes(query));
  }

  return filtered;
});

const filteredVacancies = computed(() => {
  let filtered = [...vacancies.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (selectedCategories.value.length > 0) {
    filtered = filtered.filter(vacancy => vacancy.categories.some(cat => selectedCategories.value.includes(cat)));
  }
  if (showFavoritesOnly.value) {
    filtered = filtered.filter(vacancy => isFavorite(vacancy.id));
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(vacancy => vacancy.position.toLowerCase().includes(query));
  }
  return filtered;
});

const isNew = (item) => {
  const now = new Date();
  const itemDate = new Date(item.createdAt);
  const diffInDays = (now - itemDate) / (1000 * 60 * 60 * 24);
  return diffInDays <= 3;
};

const fetchJobs = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/jobs`, { timeout: 5000 });
    jobs.value = response.data;
  } catch (error) {
    console.error('Error fetching jobs:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchVacancies = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/vacancies`, { timeout: 5000 });
    vacancies.value = response.data;
  } catch (error) {
    console.error('Error fetching vacancies:', error);
  }
};

const showJobDetails = (job) => {
  selectedJob.value = job;
  isVacancy.value = false;
  open.value = true;
};

const showVacancyDetails = (vacancy) => {
  selectedVacancy.value = vacancy;
  isVacancy.value = true;
  open.value = true;
};

const showAddJobModal = () => {
  newItem.value = {
    userId: '',
    nick: '',
    username: '',
    position: '',
    experience: null,
    description: '',
    requirements: [],
    tags: [],
    categories: [],
    contact: 'https://t.me/workiks_admin'
  };
  addMode.value = 'job';
  showAddModal.value = true;
};

const showAddVacancyModal = () => {
  newItem.value = {
    companyUserId: '',
    companyName: '',
    position: '',
    description: '',
    requirements: [],
    tags: [],
    categories: [],
    contact: '',
    officialWebsite: '',
    verified: false,
    photoUrl: ''
  };
  addMode.value = 'vacancy';
  showAddModal.value = true;
};

const toggleFilterModal = () => {
    showFilterModal.value = !showFilterModal.value;
    if (showFilterModal.value) {
      nextTick(() => {
        const firstCheckbox = document.querySelector('.filter-modal input[type="checkbox"]');
        firstCheckbox?.focus();
      });
    }
};

const addRequirement = () => {
  if (requirementsInput.value.trim()) {
    newItem.value.requirements.push(requirementsInput.value.trim());
    requirementsInput.value = '';
  }
};

const addTag = () => {
  if (tagsInput.value.trim()) {
    newItem.value.tags.push(tagsInput.value.trim());
    tagsInput.value = '';
  }
};

const submitItem = async () => {
  formSubmitted.value = true;
  if (addMode.value === 'job') {
    if (!newItem.value.userId || !newItem.value.nick || !newItem.value.position || !newItem.value.description) {
      Telegram.WebApp.showAlert("Please fill in all required fields!");
      return;
    }
    try {
      const jobData = { ...newItem.value, contact: 'https://t.me/workiks_admin', categories: newItem.value.categories || [] };
      const response = await axios.post(`${BASE_URL}/api/jobs`, jobData, {
        headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
      });
      jobs.value.push(response.data.job);
      showAddModal.value = false;
    } catch (error) {
      console.error('Error submitting job:', error.response?.data || error.message);
    }
  } else {
    if (!newItem.value.companyUserId || !newItem.value.companyName || !newItem.value.position || !newItem.value.description || !newItem.value.contact || !newItem.value.officialWebsite || !newItem.value.photoUrl) {
      Telegram.WebApp.showAlert("Please fill in all required fields!");
      return;
    }
    try {
      const vacancyData = { ...newItem.value, categories: newItem.value.categories || [] };
      const response = await axios.post(`${BASE_URL}/api/vacancies`, vacancyData, {
        headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
      });
      vacancies.value.push(response.data.vacancy);
      showAddModal.value = false;
    } catch (error) {
      console.error('Error submitting vacancy:', error.response?.data || error.message);
    }
  }
};

const deleteJob = async (jobId) => {
  try {
    await axios.delete(`${BASE_URL}/api/jobs/${jobId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    jobs.value = jobs.value.filter(job => job.id !== jobId);
    open.value = false;
  } catch (error) {
    console.error('Error deleting job:', error.response?.data || error.message);
  }
};

const deleteVacancy = async (vacancyId) => {
  try {
    await axios.delete(`${BASE_URL}/api/vacancies/${vacancyId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    vacancies.value = vacancies.value.filter(vacancy => vacancy.id !== vacancyId);
    open.value = false;
  } catch (error) {
    console.error('Error deleting vacancy:', error.response?.data || error.message);
  }
};

const checkAdminStatus = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/isAdmin`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    isAdmin.value = response.data.isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    isAdmin.value = false;
  }
};

const handleClickOutside = (event) => {
  const isProfileLink = event.target.closest('.profile-link') !== null;

  if (searchInput.value && !searchInput.value.contains(event.target)) {
    searchInput.value.blur();
  }

  if (isProfileLink) return;
};

const toggleFavorite = async (itemId) => {
  const index = favoriteJobs.value.indexOf(itemId);
  const job = jobs.value.find(j => j.id === itemId) || vacancies.value.find(v => v.id === itemId);
  const telegramData = window.Telegram.WebApp.initData;

  if (!telegramData) {
    console.error('Telegram WebApp data not available');
    return;
  }

  const params = new URLSearchParams(telegramData);
  const user = JSON.parse(params.get("user") || "{}");

  try {
    if (index === -1) {
      favoriteJobs.value.push(itemId);
      await axios.post(`${BASE_URL}/api/subscribe`, {
        userId: user.id,
        category: job.categories[0]
      }, {
        headers: { 'X-Telegram-Data': telegramData }
      });
      Telegram.WebApp.showAlert("Вы подписались на уведомления для этой категории!");
    } else {
      favoriteJobs.value.splice(index, 1);
      await axios.post(`${BASE_URL}/api/unsubscribe`, {
        userId: user.id,
        category: job.categories[0]
      }, {
        headers: { 'X-Telegram-Data': telegramData }
      });
      Telegram.WebApp.showAlert("Вы отписались от уведомлений для этой категории.");
    }
    localStorage.setItem('favoriteJobs', JSON.stringify(favoriteJobs.value));
  } catch (error) {
    console.error('Error toggling favorite:', error.response?.data || error.message);
    Telegram.WebApp.showAlert("Произошла ошибка при подписке/отписке.");
  }
};

const isFavorite = (itemId) => favoriteJobs.value.includes(itemId);

const handleImageError = (event) => {
  event.target.src = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
};

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    Telegram.WebApp.disableVerticalSwipes();
    if (Telegram.WebApp.setHeaderColor) {
      Telegram.WebApp.setHeaderColor('#97f492');
    }
    if (window.Telegram.WebApp.initDataUnsafe?.user) {
      const user = Telegram.WebApp.initDataUnsafe.user;
      userPhoto.value = user.photo_url || `https://t.me/i/userpic/160/${user.username}.jpg`;
      userFirstName.value = user.first_name || '';
      userLastName.value = user.last_name || '';
      currentUserId.value = user.id;
      currentUsername.value = user.username;
    }
  }
  checkAdminStatus();
  fetchJobs();
  fetchVacancies();
});
</script>

<style scoped>
.container { background: linear-gradient(45deg, #101622, #1a2233); min-height: 100vh; padding: 20px; overflow: hidden; position: relative; }
.nav-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.profile-link { display: flex; align-items: center; gap: 10px; text-decoration: none; position: relative; transition: all 0.3s ease; }
.profile-link:hover::after { content: "View Profile"; position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #97f492; padding: 4px 8px; border-radius: 6px; font-size: 12px; white-space: nowrap; animation: fade-in 0.3s ease; }
.profile-icon { width: 47px; height: 47px; border-radius: 50%; border: 2px solid #97f492; position: relative; overflow: hidden; animation: pulse-border 2s infinite; }
@keyframes pulse-border { 0% { box-shadow: 0 0 0 0 rgba(151, 244, 146, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(151, 244, 146, 0); } 100% { box-shadow: 0 0 0 0 rgba(151, 244, 146, 0); } }
.user-name { display: flex; flex-direction: column; gap: 2px; }
.first-name { font-size: 16px; font-weight: 600; animation: fade-in 0.5s ease-in-out, color-change 5s infinite; }
@keyframes color-change { 0% { color: #97f492; } 50% { color: #6de06a; } 100% { color: #97f492; } }
.add-button { background: linear-gradient(135deg, #97f492 0%, #6de06a 100%); padding: 8px 20px; border-radius: 30px; color: #000; font-weight: 400; box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3); transition: 0.3s; font-size: 14px; text-decoration: none; animation: pulse 2s infinite; }
.add-button:hover { transform: translateY(-2px); }
.categories { display: flex; gap: 15px; margin-bottom: 20px; flex-shrink: 0; }
.category-btn { background: #272e38; color: #fff; border: none; padding: 10px 25px; border-radius: 12px; cursor: pointer; transition: 0.3s; font-size: 14px; font-weight: 600; }
.category-btn.active { background: #97f492; color: #000; animation: pulse 2s infinite; }
.content { display: flex; flex-direction: column; height: calc(100vh - 100px); }
.search-and-filter { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
.search-container { flex: 1; }
.search-input { width: 100%; padding: 12px 20px; border-radius: 12px; border: none; background: #272e38; color: #fff; font-size: 14px; transition: all 0.3s; }
.search-input:focus { outline: none; box-shadow: 0 0 0 2px #97f492; }
.search-input::placeholder { color: #6b7280; }
.filter-icon { background: #272e38; border: none; padding: 7px; border-radius: 12px; cursor: pointer; transition: 0.3s; }
.filter-icon:hover { background: #97f492; }
.filter-icon:hover svg { stroke: #000; }
.jobs-scroll-container { flex-grow: 1; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; }
.jobs-scroll-container::-webkit-scrollbar { display: none; }
.jobs-list { display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); padding-bottom: 20px; }
.job-card { background: #181e29; width: auto; min-width: 300px; border-radius: 20px; padding: 20px; border: 1px solid #2d3540; transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; text-align: left; box-sizing: border-box; position: relative; }
.job-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); border-color: #97f492; }
.job-icon { width: 40px; height: 40px; border-radius: 10px; transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer; object-fit: cover; }
.job-icon:hover { transform: scale(1.1); box-shadow: 0 0 15px rgba(151, 244, 146, 0.5); }
.card-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; position: relative; }
.nick { color: #97f492; font-size: 14px; margin: 0; }
.work { color: #fff; font-size: 18px; margin: 0; }
.job-description { color: #8a8f98; font-size: 14px; line-height: 1.5; }
.tags { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; max-width: 100%; }
.tag { background: #2d3540; color: #97f492; padding: 5px 12px; border-radius: 8px; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
.filter-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; }
.filter-modal { background: #181e29; width: 300px; border-radius: 20px; padding: 15px; transform: scale(0); animation: scale-in 0.3s ease-out forwards; }
@keyframes scale-in { to { transform: scale(1); } }
.filter-modal h3 { color: #97f492; margin: 0 0 10px 0; font-size: 16px; }
.filter-section { margin-bottom: 15px; }
.filter-section h4 { color: #fff; margin: 0 0 8px 0; font-size: 14px; }
.checkbox-label { display: block; color: #c2c6cf; margin-bottom: 8px; cursor: pointer; font-size: 14px; }
.checkbox-label input { margin-right: 8px; }
.apply-btn { background: linear-gradient(135deg, #97f492 0%, #6de06a 100%); color: #000; padding: 8px; width: 100%; border: none; border-radius: 12px; cursor: pointer; transition: transform 0.2s; font-size: 14px; }
.apply-btn:hover { transform: translateY(-2px); }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: flex-end; }
.modal { background: #181e29; width: 100%; border-radius: 20px 20px 0 0; padding: 25px; max-height: 90vh; overflow-y: auto; transform: translateY(100%); animation: slide-up 0.3s ease-out forwards; scrollbar-width: none; -ms-overflow-style: none; }
.modal::-webkit-scrollbar { display: none; }
@keyframes slide-up { to { transform: translateY(0); } }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.modal-header h2 { color: #97f492; margin: 0; }
.close-btn { background: none; border: none; color: #fff; font-size: 28px; cursor: pointer; padding: 0 10px; }
.job-details { display: flex; flex-direction: column; gap: 20px; }
.user-info { display: flex; align-items: center; gap: 15px; position: relative; }
.company-link { display: flex; align-items: center; gap: 15px; text-decoration: none; }
.nickname { color: #97f492; margin: 0; font-size: 18px; position: relative; display: inline-block; cursor: pointer; }
.nickname::after { content: ""; position: absolute; bottom: -2px; left: 0; width: 0; height: 2px; background: #97f492; transition: width 0.3s ease; }
.nickname:hover::after { width: 100%; }
.experience { color: #8a8f98; margin: 0; font-size: 14px; }
.section h3 { color: #fff; margin: 0 0 10px 0; font-size: 16px; }
.description { color: #c2c6cf; line-height: 1.5; margin: 0; }
.requirements { padding-left: 20px; margin: 0; color: #c2c6cf; }
.requirements li { margin-bottom: 8px; }
.contact-btn { background: linear-gradient(135deg, #97f492 0%, #6de06a 100%); color: #000; text-align: center; padding: 15px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px; transition: transform 0.2s; }
.contact-btn:hover { transform: translateY(-2px); }
.delete-btn { background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%); color: #fff; text-align: center; padding: 15px; border-radius: 12px; border: none; font-weight: 600; margin-top: 20px; cursor: pointer; transition: transform 0.2s; }
.delete-btn:hover { transform: translateY(-2px); }
.delete-req, .delete-tag { background: none; border: none; color: #ff6b6b; cursor: pointer; margin-left: 5px; font-size: 16px; }
textarea.search-input { min-height: 100px; resize: vertical; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.3s, transform 0.3s; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(100%); }
@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
.skeleton-container { display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.skeleton-card { background: linear-gradient(90deg, #181e29 25%, #272e38 50%, #181e29 75%); background-size: 200% 100%; animation: skeleton-wave 1.5s infinite; border-radius: 20px; padding: 20px; height: 150px; }
@keyframes skeleton-wave { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.new-label { position: absolute; top: 10px; right: 10px; background: #97f492; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.favorite-btn { background: none; border: none; font-size: 30px; cursor: pointer; padding: 0; position: absolute; right: 10px; top: 3px; }
.favorite-btn span { color: #8a8f98; transition: color 0.3s; }
.favorite-btn .favorite { color: #97f492; }
.invalid { border: 2px solid #ff6b6b; animation: shake 0.5s; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
.selected-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.filter-pill { display: inline-flex; align-items: center; background: #2d3540; padding: 6px 12px; border-radius: 20px; color: #97f492; font-size: 14px; }
.filter-pill button { background: none; border: none; color: #97f492; margin-left: 8px; cursor: pointer; }
.verified-badge { color: #97f492; font-size: 14px; margin-left: 5px; }
</style>