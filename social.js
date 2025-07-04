let currentUser = null;

// --- Auth & Profile Setup ---
document.addEventListener('DOMContentLoaded', async () => {
    // Enforce authentication
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;
    await loadSidebarProfile();
    await loadUserStats();
    await loadPosts();
    await loadNotifications();
    setupNavbar();
    // Ensure following is loaded before user list for correct follow status
    await loadFollowing();
    await refreshUserList();
});

async function loadSidebarProfile() {
    const profile = await getCurrentUserProfile();
    document.getElementById('currentUserName').textContent = profile?.full_name || 'User';
    document.getElementById('currentUserBio').textContent = profile?.description || '';
    document.getElementById('currentUserImg').src = profile?.avatar_url || 'assets/default-avatar.svg';
}

async function getCurrentUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, description')
        .eq('id', user.id)
        .single();
    return data || null;
}

async function loadUserStats() {
    const userId = currentUser.id;
    // Posts count
    const { count: postsCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    document.getElementById('currentUserPosts').querySelector('.stat-number').textContent = postsCount || 0;
    // Followers count
    const { count: followersCount } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId);
    document.getElementById('currentUserFollowers').querySelector('.stat-number').textContent = followersCount || 0;
    // Following count
    const { count: followingCount } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId);
    document.getElementById('currentUserFollowing').querySelector('.stat-number').textContent = followingCount || 0;
}

// --- Post CRUD ---
document.getElementById('updatePostBtn').addEventListener('click', createPost);

// Custom Upload Image Button Logic
const postImageInput = document.getElementById('postImage');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const imageNameSpan = document.getElementById('imageName');
const imagePreview = document.getElementById('imagePreview');

uploadImageBtn.addEventListener('click', () => {
    postImageInput.click();
});

postImageInput.addEventListener('change', () => {
    const file = postImageInput.files[0];
    if (file) {
        imageNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = function (e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    } else {
        imageNameSpan.textContent = '';
        imagePreview.src = '';
        imagePreview.style.display = 'none';
    }
});

async function createPost() {
    const content = document.getElementById('postContent').value.trim();
    const imageFile = document.getElementById('postImage').files[0];
    if (!content && !imageFile) {
        alert('Please add some content or an image');
        return;
    }
    let imageUrl = null;
    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(fileName, imageFile);
        if (uploadError) {
            alert('Image upload failed: ' + uploadError.message);
            return;
        }
        const { data } = supabase.storage.from('posts').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
    }
    const { error } = await supabase
        .from('posts')
        .insert([{ user_id: currentUser.id, content, image_url: imageUrl }]);
    if (error) {
        alert('Failed to create post: ' + error.message);
        return;
    }
    document.getElementById('postContent').value = '';
    document.getElementById('postImage').value = '';
    imageNameSpan.textContent = '';
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    await loadUserStats();
    await loadPosts();
}

// --- User List, Filter, and Search ---
let allUsers = [];
let followers = [];
let following = [];
let filteredUsers = [];
let currentUserPostsView = null; // user_id if filtering posts, null otherwise

// Helper to get user details from profiles table by array of ids
async function getUsersByIds(ids) {
    if (!ids.length) return [];
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, phone, full_name, avatar_url')
        .in('id', ids);
    return data || [];
}

async function loadAllUsers() {
    // Load all users from 'profiles' table except current user
    const { data, error } = await supabase.from('profiles').select('id, full_name, avatar_url, email, phone');
    allUsers = (data || []).filter(u => u.id !== currentUser.id);
}
async function loadFollowers() {
    // Get follower ids from follows table
    const { data: follows, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUser.id);
    const ids = (follows || []).map(f => f.follower_id).filter(Boolean);
    followers = await getUsersByIds(ids);
}
async function loadFollowing() {
    // Get following ids from follows table
    const { data: follows, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id);
    const ids = (follows || []).map(f => f.following_id).filter(Boolean);
    following = await getUsersByIds(ids);
}
async function refreshUserList() {
    const filter = document.getElementById('userFilterDropdown').value;
    if (filter === 'all') {
        await loadAllUsers();
        filteredUsers = allUsers;
    } else if (filter === 'followers') {
        await loadFollowers();
        filteredUsers = followers;
    } else if (filter === 'following') {
        await loadFollowing();
        filteredUsers = following;
    }
    applyUserSearch();
}
function applyUserSearch() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    let users = filteredUsers;
    if (search.length > 0) {
        users = users.filter(u => (u.full_name || '').toLowerCase().includes(search));
    }
    renderUserList(users);
}
function renderUserList(users) {
    const userList = document.getElementById('userList');
    if (!users.length) {
        userList.innerHTML = '<div class="loading">No users found</div>';
        return;
    }
    userList.innerHTML = users.map(user => {
        return `<div class="user-card" data-user-id="${user.id}">
            <div class="user-card-info" data-user-id="${user.id}">
                <img src="${user.avatar_url || 'assets/default-avatar.svg'}" class="user-card-img" alt="${user.full_name || 'User'}">
                <span class="user-card-name">${user.full_name || 'User'}</span>
            </div>
            <div class="user-card-actions">
                <i class="fa fa-address-card user-card-contact-icon" data-contact-btn data-user-id="${user.id}" title="Contact Info"></i>
            </div>
        </div>`;
    }).join('');
}
// --- User List Event Delegation ---
document.getElementById('userList').addEventListener('click', async (e) => {
    const userId = e.target.getAttribute('data-user-id');
    if (e.target.hasAttribute('data-contact-btn')) {
        const user = [...allUsers, ...followers, ...following].find(u => u.id === userId);
        showContactInfoModal(user);
    } else {
        // Only trigger post filtering if a user card or its info is clicked, but not the contact icon
        let card = e.target.closest('.user-card');
        if (card && !e.target.classList.contains('user-card-contact-icon')) {
            const selectedUserId = card.getAttribute('data-user-id');
            currentUserPostsView = selectedUserId;
            document.getElementById('showAllPostsBtn').style.display = 'inline-block';
            await loadPosts(selectedUserId);
        }
    }
});
function showContactInfoModal(user) {
    document.getElementById('contactInfoContent').innerHTML = user ?
        `<p><strong>Name:</strong> ${user.full_name || 'User'}</p>
         <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
         <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>` :
        '<p>User not found.</p>';
    document.getElementById('contactInfoModal').style.display = 'block';
}
document.getElementById('closeContactInfoModal').addEventListener('click', () => {
    document.getElementById('contactInfoModal').style.display = 'none';
});
// --- User Filter & Search Events ---
document.getElementById('userFilterDropdown').addEventListener('change', refreshUserList);
document.getElementById('searchInput').addEventListener('input', applyUserSearch);
// --- Show All Posts Button ---
document.getElementById('showAllPostsBtn').addEventListener('click', async () => {
    currentUserPostsView = null;
    document.getElementById('showAllPostsBtn').style.display = 'none';
    await loadPosts();
});
// --- Patch loadPosts to support user filter ---
async function loadPosts(userId = null) {
    let query = supabase
        .from('posts')
        .select(`*, profiles: user_id (id, full_name, avatar_url), likes (user_id)`)
        .order('created_at', { ascending: false });
    if (userId) {
        query = query.eq('user_id', userId);
    }
    const { data: posts, error } = await query;
    if (error) {
        console.error('Error loading posts:', error);
        document.getElementById('postFeed').innerHTML = '<div class="loading">Failed to load posts. Check the console for details.</div>';
        return;
    }
    // For each post, check if current user follows the author (batch follow check)
    if (posts && posts.length && currentUser) {
        const authorIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
        let followsMap = {};
        if (authorIds.length) {
            const { data: followsData } = await supabase
                .from('follows')
                .select('follower_id, following_id')
                .in('follower_id', [currentUser.id])
                .in('following_id', authorIds);
            if (followsData) {
                followsData.forEach(f => {
                    followsMap[f.following_id] = true;
                });
            }
        }
        posts.forEach(post => {
            post.isFollowing = followsMap[post.user_id] || false;
        });
    }
    renderPosts(posts || []);
}

// Add renderPosts function to display posts in the UI
function renderPosts(posts) {
    const postFeed = document.getElementById('postFeed');
    if (!posts.length) {
        postFeed.innerHTML = '<div class="loading">No posts to show</div>';
        return;
    }
    postFeed.innerHTML = posts.map(post => {
        const isOwn = post.user_id === currentUser.id;
        const isLiked = Array.isArray(post.likes) && post.likes.some(like => like.user_id === currentUser.id);
        const isFollowing = !!post.isFollowing;
        return `<div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-user-info">
                    <img src="${post.profiles?.avatar_url || 'assets/default-avatar.svg'}" alt="${post.profiles?.full_name || 'User'}" class="post-user-img">
                    <div class="post-user-name">${post.profiles?.full_name || 'User'}</div>
                </div>
                <button class="follow-btn${isFollowing ? ' following' : ''}" onclick="toggleFollow('${post.user_id}')">${isFollowing ? 'Following' : 'Follow'}</button>
            </div>
            <div class="post-content">${post.content || ''}</div>
            ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="post-image">` : ''}
            <div class="post-actions">
                <button class="action-btn${isLiked ? ' liked' : ''}" onclick="toggleLike('${post.id}')">❤️ ${Array.isArray(post.likes) ? post.likes.length : 0}</button>
                <button class="action-btn" onclick="openPostModal('${post.id}')">💬</button>
                <button class="action-btn" onclick="sharePost('${post.id}')">🔄</button>
                <button class="action-btn" onclick="window.location.href='message.html'">✉️ Message</button>
                ${isOwn ? `<button class="delete-btn" onclick="deletePost('${post.id}')">Delete</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

// Restore toggleFollow and sendNotification for post cards
async function toggleFollow(userId) {
    if (userId === currentUser.id) return;
    const { data: follow } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .single();
    let isNowFollowing = false;
    if (follow) {
        await supabase.from('follows').delete().eq('id', follow.id);
        isNowFollowing = false;
    } else {
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: userId }]);
        await sendNotification(userId, 'follow', `${currentUser.email} started following you`);
        isNowFollowing = true;
    }
    // Update follow button in the DOM for all posts by this user
    document.querySelectorAll(`.post-card[data-post-id] .follow-btn`).forEach(btn => {
        if (btn.getAttribute('onclick') === `toggleFollow('${userId}')`) {
            btn.textContent = isNowFollowing ? 'Following' : 'Follow';
            btn.classList.toggle('following', isNowFollowing);
        }
    });
}

async function toggleLike(postId) {
    // Check if already liked
    const { data: like, error } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();
    let isNowLiked = false;
    let newLikeCount = 0;
    if (like) {
        await supabase.from('likes').delete().eq('id', like.id);
        isNowLiked = false;
    } else {
        await supabase.from('likes').insert([{ post_id: postId, user_id: currentUser.id }]);
        await sendNotificationToPostOwner(postId, 'like');
        isNowLiked = true;
    }
    // Get new like count
    const { count } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);
    newLikeCount = count || 0;
    // Update like button in the DOM
    const likeBtn = document.querySelector(`.post-card[data-post-id="${postId}"] .action-btn`);
    if (likeBtn) {
        // Remove and re-add .liked to trigger animation
        likeBtn.classList.remove('liked');
        void likeBtn.offsetWidth; // force reflow
        if (isNowLiked) likeBtn.classList.add('liked');
        likeBtn.innerHTML = `❤️ ${newLikeCount}`;
    }
}

async function sendNotification(userId, type, message, postId = null) {
    await supabase.from('notifications').insert([{ user_id: userId, from_user_id: currentUser.id, type, message, post_id: postId }]);
}

// Add sendNotificationToPostOwner for like notifications
async function sendNotificationToPostOwner(postId, type) {
    // Get post owner
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
    if (post && post.user_id !== currentUser.id) {
        await sendNotification(post.user_id, type, `${currentUser.email} liked your post`, postId);
    }
}

// --- Patch setupNavbar to refresh user list after login ---
function setupNavbar() {
    const loginButton = document.getElementById('nav-login-btn');
    const profileDropdown = document.getElementById('nav-profile-dropdown');
    const profileNameNav = document.getElementById('nav-profile-name');
    const profileImageNav = document.getElementById('nav-profile-image');
    const logoutButton = document.getElementById('nav-logout-btn');
    if (loginButton) loginButton.style.display = 'none';
    if (profileDropdown) profileDropdown.style.display = 'flex';
    getCurrentUserProfile().then(profile => {
        if (profileNameNav) profileNameNav.textContent = profile?.full_name || currentUser.email;
        if (profileImageNav) profileImageNav.src = profile?.avatar_url || 'assets/default-avatar.svg';
    });
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout(); // from auth.js
        });
    }
    // Profile dropdown toggle
    const profileTrigger = document.querySelector('.profile-trigger');
    if (profileTrigger) {
        profileTrigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const content = profileTrigger.nextElementSibling;
            if (content && content.classList.contains('dropdown-content')) {
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
            }
        });
    }
    // Close dropdown if clicked outside
    window.addEventListener('click', function (event) {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            const content = document.querySelector('.profile-dropdown .dropdown-content');
            if (content) content.style.display = 'none';
        }
    });
    // After setting up navbar, load user list
    refreshUserList();
    loadFollowing();
}
// --- Search (basic, can be expanded) ---
document.getElementById('searchInput').addEventListener('input', async (e) => {
    const searchTerm = e.target.value.trim();
    if (searchTerm.length < 2) return;
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${searchTerm}%`)
        .limit(5);
    // Show results as a dropdown or log to console
    console.log('Search results:', data);
});

// --- Notifications ---
async function loadNotifications() {
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    updateNotificationUI(notifications || []);
}

function updateNotificationUI(notifications) {
    const notificationCount = notifications.filter(n => !n.is_read).length;
    const notifCountSpan = document.getElementById('notificationCount');
    notifCountSpan.textContent = notificationCount;
    notifCountSpan.style.display = notificationCount > 0 ? 'inline-block' : 'none';
    document.getElementById('notificationList').innerHTML = notifications.length
        ? notifications.map(n => `<div class="notification-item${n.is_read ? '' : ' unread'}">${n.message}</div>`).join('')
        : '<div class="loading">No notifications</div>';
}

document.getElementById('notificationBtn').addEventListener('click', () => {
    document.getElementById('notificationModal').style.display = 'block';
    markAllNotificationsRead();
});
document.getElementById('closeNotifications').addEventListener('click', () => {
    document.getElementById('notificationModal').style.display = 'none';
});

async function markAllNotificationsRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
    await loadNotifications();
}
