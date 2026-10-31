<script>
import { ValidationObserver, ValidationProvider } from '@/plugins/validation'
import '@/plugins/vee-validate'
import { Cropper, Preview } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import 'vue-advanced-cropper/dist/theme.compact.css'

function getMimeType(file, fallback = null) {
  const byteArray = (new Uint8Array(file)).subarray(0, 4)
  let header = ''
  for (let i = 0; i < byteArray.length; i++) {
    header += byteArray[i].toString(16)
  }
  switch (header) {
    case '89504e47':
      return 'image/png'
    case '47494638':
      return 'image/gif'
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
    case 'ffd8ffe3':
    case 'ffd8ffe8':
      return 'image/jpeg'
    default:
      return fallback
  }
}

const avatarUrlPrefix = 'v1/users/avatar?token='

export default {
  name: 'AccountPanel',
  emits: ['close'],
  components: {
    ValidationObserver,
    ValidationProvider,
    Cropper,
    Preview,
  },
  data() {
    return {
      isLoading: false,
      state: 1,
      user: this.$store.state.user,
      username: this.$store.state.user.username,
      avatarUrl: `${avatarUrlPrefix}${this.$store.state.token || localStorage.getItem('access_token')}`,
      oriPassword: '',
      password: '',
      confirmation: '',
      message: '',
      notificationShow: false,
      image: {
        src: null,
        type: null,
      },
      result: {
        coordinates: null,
        image: null,
        canvas: null,
      },
      stencilProps: {
        aspectRatio: 1,
      },
      canvasProps: {
        height: 160,
        width: 160,
      },
    }
  },
  computed: {
    title() {
      let val = ''
      switch (this.state) {
        case 1:
          val = this.$t('Account')
          break
        case 2:
          val = this.$t('Change name')
          break

        case 3:
          val = this.$t('Change Password')
          break
        case 4:
          val = this.$t('Change Avatar')
          break
        default:
          break
      }
      return val
    },
    userInfo() {
      return this.$store.state.user
    },
    bodyPadding() {
      return this.state === 1 || this.state === 4 ? 'px-40 py-24' : ''
    },
    buttonAlign() {
      return this.state === 1 ? 'is-justify-content-center' : 'is-justify-content-end'
    },
  },
  destroyed() {
    if (this.image.src) {
      URL.revokeObjectURL(this.image.src)
    }
  },

  methods: {
    goto(val) {
      this.state = val
      // Edit a copy of the current user: the store may have been refreshed since this panel was
      // created, and Back must not leave unsaved changes in the header
      if (val === 2)
        this.user = { ...this.userInfo }
      if (val === 1) {
        if (this.image.src) {
          URL.revokeObjectURL(this.image.src)
        }
        this.oriPassword = ''
        this.password = ''
        this.confirmation = ''
        this.notificationShow = false
        this.username = this.userInfo.username
      }
    },
    onChange({ coordinates, image, canvas }) {
      this.result = {
        coordinates,
        image,
        canvas,
      }
    },
    loadImage(event) {
      const { files } = event.target
      if (files && files[0]) {
        if (this.image.src) {
          URL.revokeObjectURL(this.image.src)
        }
        const blob = URL.createObjectURL(files[0])
        const reader = new FileReader()
        reader.onload = (e) => {
          this.image = {
            src: blob,
            type: getMimeType(e.target.result, files[0].type),
          }
          this.goto(4)
        }
        reader.readAsArrayBuffer(files[0])
      }
      // Choosing the same file again must trigger a new change event
      event.target.value = ''
    },
    defaultSize({ imageSize, visibleArea }) {
      return {
        width: (visibleArea || imageSize).width,
        height: (visibleArea || imageSize).height,
      }
    },

    async updateUserInfo() {
      try {
        const userRes = await this.$api.users.getUserInfo()
        this.$store.commit('SET_USER', userRes.data.data)
        this.goto(1)
      }
      catch (error) {
        console.error(error.response?.data?.message)
      }
    },
    async saveUser() {
      this.isLoading = true
      try {
        const res = await this.$api.users.setUserInfo(this.user)
        this.$store.commit('SET_USER', res.data.data)
        this.user = res.data.data
        this.goto(1)
        this.isLoading = false
      }
      catch (error) {
        console.error(error.response?.data?.message)
        this.isLoading = false
      }
    },

    async savePassword() {
      this.isLoading = true
      try {
        await this.$api.users.changePassword({
          old_password: this.oriPassword,
          password: this.password,
        })
        this.oriPassword = ''
        this.password = ''
        this.confirmation = ''
        this.isLoading = false
        this.notificationShow = false
        this.$buefy.toast.open({ message: this.$t('Password changed'), type: 'is-success' })
        this.goto(1)
      }
      catch (error) {
        this.isLoading = false
        this.notificationShow = true
        this.message = error.response?.data?.message
      }
    },

    async saveAvatar() {
      // The cropper reports its canvas after the first change
      if (!this.result.canvas)
        return
      this.isLoading = true
      const imageData = this.result.canvas.toDataURL()
      this.$api.users.saveAvatar({ file: imageData }).then(() => {
        this.$buefy.toast.open({
          message: this.$t(`Update successful`),
          type: 'is-success',
        })
        this.isLoading = false
        this.state = 1
        // Same URL as before: add a parameter so the new picture is loaded
        this.avatarUrl = `${avatarUrlPrefix}${this.$store.state.token || localStorage.getItem('access_token')}&t=${Date.now()}`
      }).catch(() => {
        this.$buefy.toast.open({
          message: this.$t(`Update failure`),
          type: 'is-danger',
        })
        this.isLoading = false
      })
    },
    logout() {
      this.$messageBus('account_setting_logout')
      this.$store.commit('SET_DEFAULT_WALLPAPER')
      this.$router.push('/logout')
    },
  },
}
</script>

<template>
  <!-- Atrio: account in the side panel opened from the header -->
  <div class="atrio-account">
    <ValidationObserver v-slot="{ handleSubmit }" slim>
      <header class="atrio-sheet-head">
        <button v-if="state !== 1" :aria-label="$t('Back')" class="atrio-icon-button" type="button" @click.stop="goto(1)">
          <b-icon icon="left-outline" pack="casa" />
        </button>
        <div class="atrio-sheet-title">
          <h2>{{ title }}</h2>
        </div>
        <button :aria-label="$t('Close')" class="atrio-icon-button" type="button" @click="$emit('close')">
          <b-icon icon="close-outline" pack="casa" />
        </button>
      </header>

      <template v-if="state === 1">
        <div class="atrio-account-profile">
          <label :title="$t('Change Avatar')" class="atrio-account-avatar">
            <img :src="avatarUrl" alt="" @error="$event.target.src = $asset('@/assets/img/account/default-avatar.svg')">
            <span class="atrio-account-avatar-edit">
              <b-icon icon="edit-outline" pack="casa" />
            </span>
            <input :aria-label="$t('Change Avatar')" accept="image/*" class="atrio-account-file" type="file" @change="loadImage($event)">
          </label>
          <p class="atrio-account-name">{{ userInfo.username }}</p>
        </div>

        <section class="atrio-settings-section">
          <div class="atrio-setting-row">
            <b-icon icon="account-outline" pack="casa" size="is-20" />
            <span class="atrio-setting-label">
              {{ $t('Name') }}
              <small class="atrio-setting-note">{{ userInfo.username }}</small>
            </span>
            <button class="atrio-button is-small" type="button" @click.stop="goto(2)">{{ $t('Change') }}</button>
          </div>
          <div class="atrio-setting-row">
            <b-icon icon="lock-outline" pack="mdi" size="is-20" />
            <span class="atrio-setting-label">
              {{ $t('Password') }}
              <small class="atrio-setting-note">••••••</small>
            </span>
            <button class="atrio-button is-small" type="button" @click.stop="goto(3)">{{ $t('Change') }}</button>
          </div>
        </section>

        <button class="atrio-button is-danger atrio-account-logout" type="button" @click="logout">
          <b-icon icon="logout" pack="mdi" size="is-16" />
          {{ $t('Logout') }}
        </button>
      </template>

      <form v-else-if="state === 2" class="atrio-account-form" @submit.prevent="handleSubmit(saveUser)">
        <ValidationProvider v-slot="{ errors, valid }" name="User" rules="required">
          <b-field :label="$t('Name')" :message="(errors[0] ? $t('Enter a name') : '')" :type="{ 'is-danger': errors[0], 'is-success': valid }">
            <b-input v-model="user.username" autocomplete="username" type="text" />
          </b-field>
        </ValidationProvider>
        <div class="atrio-account-actions">
          <button class="atrio-button" type="button" @click.stop="goto(1)">{{ $t('Back') }}</button>
          <button class="atrio-button is-primary" type="submit">{{ $t('Save') }}</button>
        </div>
      </form>

      <form v-else-if="state === 3" class="atrio-account-form" @submit.prevent="handleSubmit(savePassword)">
        <p v-if="notificationShow" class="atrio-account-error" role="alert">{{ message || $t('the action failed') }}</p>
        <ValidationProvider v-slot="{ errors, valid }" name="oriPassword" rules="required|min:5" vid="oriPassword">
          <b-field :label="$t('Original password')" :message="(errors[0] ? $t(errors[0], { length: 5 }) : '')" :type="{ 'is-danger': errors[0], 'is-success': valid }">
            <b-input v-model="oriPassword" autocomplete="current-password" password-reveal type="password" />
          </b-field>
        </ValidationProvider>
        <ValidationProvider v-slot="{ errors, valid }" name="Password" rules="required|min:5" vid="password">
          <b-field :label="$t('New password')" :message="(errors[0] ? $t(errors[0], { length: 5 }) : '')" :type="{ 'is-danger': errors[0], 'is-success': valid }">
            <b-input v-model="password" autocomplete="new-password" password-reveal type="password" />
          </b-field>
        </ValidationProvider>
        <ValidationProvider v-slot="{ errors, valid }" name="Password Confirmation" rules="required|confirmed:password">
          <b-field :label="$t('Confirm the new password again')" :message="(errors[0] ? $t(errors[0]) : '')" :type="{ 'is-danger': errors[0], 'is-success': valid }">
            <b-input v-model="confirmation" autocomplete="new-password" password-reveal type="password" />
          </b-field>
        </ValidationProvider>
        <div class="atrio-account-actions">
          <button class="atrio-button" type="button" @click.stop="goto(1)">{{ $t('Back') }}</button>
          <button class="atrio-button is-primary" type="submit">{{ $t('Save') }}</button>
        </div>
      </form>

      <div v-else-if="state === 4" class="atrio-account-form">
        <div class="atrio-account-crop">
          <div class="cropper-wrapper">
            <Cropper :canvas="canvasProps" :debounce="false" :default-size="defaultSize" :min-height="80" :min-width="80" :src="image.src" :stencil-props="stencilProps" check-orientation @change="onChange" />
          </div>
          <div class="atrio-account-preview">
            <Preview :coordinates="result.coordinates" :height="80" :image="result.image" :width="80" class="preview" />
            <p>{{ $t('Preview') }}</p>
          </div>
        </div>
        <div class="atrio-account-actions">
          <button class="atrio-button" type="button" @click.stop="goto(1)">{{ $t('Back') }}</button>
          <button class="atrio-button is-primary" type="button" @click="handleSubmit(saveAvatar)">{{ $t('Save') }}</button>
        </div>
      </div>
    </ValidationObserver>
    <b-loading v-model="isLoading" :is-full-page="false" />
  </div>
</template>

<style lang="scss" scoped>
.cropper-wrapper {
  width: 220px;
  height: 220px;
  overflow: hidden;
  position: relative;
  border-radius: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
}

.preview {
  border-radius: 50%;
}

.vue-advanced-cropper {
  ::v-deep img {
    max-height: none !important;
  }
}

::v-deep .vue-preview__image {
  max-height: none !important;
}

::v-deep .vue-simple-handler-wrapper {
  width: 18px !important;
  height: 18px !important;
}
</style>

<style lang="scss">
.atrio-account {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.atrio-account-profile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0 0.25rem;
}

.atrio-account-avatar {
  position: relative;
  width: 6rem;
  height: 6rem;
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12);
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover .atrio-account-avatar-edit,
  &:focus-within .atrio-account-avatar-edit {
    opacity: 1;
  }
}

.atrio-account-avatar-edit {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.atrio-account-file {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.atrio-account-name {
  color: var(--atrio-text);
  font-size: 1.25rem;
  font-weight: 700;
}

.atrio-account-logout {
  justify-content: center;

  &.is-danger {
    border-color: rgba(248, 113, 113, 0.35);
    color: #fca5a5;

    &:hover {
      background: rgba(248, 113, 113, 0.12);
    }
  }
}

.atrio-account-form {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  .label {
    color: var(--atrio-text-soft);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .input {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: none;
    color: var(--atrio-text);

    &:focus {
      border-color: var(--atrio-accent);
      box-shadow: 0 0 0 1px var(--atrio-accent);
    }

    &.is-danger {
      border-color: #f87171;
    }
  }

  .control .icon {
    color: var(--atrio-text-soft) !important;
  }

  .help.is-danger {
    color: #fca5a5;
  }
}

.atrio-account-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.75rem;
}

.atrio-account-error {
  margin-bottom: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.75rem;
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
  font-size: 0.875rem;
}

.atrio-account-crop {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.atrio-account-preview {
  text-align: center;

  p {
    margin-top: 0.5rem;
    color: var(--atrio-text-muted);
    font-size: 0.8125rem;
  }
}
</style>
