import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { isAnyFieldSet } from '@utils/utils';
import styles from './ClientSettings.module.scss';
import api from '@api';

import StatCard from '@components/ui/StatCard/StatCard';
import Form from '@components/common/Form/Form';
import Input from '@components/common/Input/Input';
import Icon from '@components/common/Icon/Icon';
import Button from '@components/common/Button/Button';
import Modal from '@components/common/Modal/Modal';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';
import Spinner from '@components/common/Spinner/Spinner';
import Error from '@components/common/Error/Error';

function ClientSettings() {
  const { profile, setProfile, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false); // Used to disable the update profile button

  // Popup states
  const [uploadPicturePopup, setUploadPicturePopup] = useState(false);
  const [deletePicturePopup, setDeletePicturePopup] = useState(false);
  const [deleteProfilePopup, setDeleteProfilePopup] = useState(false);

  /**
   * Defines fetching latest profile data
   */
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      const { profile } = await api.client.getClientProfile();
      setProfile(profile);
    } finally {
      setIsLoading(false);
    }
  }, [setProfile]);

  /**
   *  Fetches on mount to keep profile data always up to date
   */
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // While fetching latest profile data show loading spinner
  if (isLoading) return <Spinner />;

  // Upload picture popup state handlers
  const openUploadPicturePopup = () => setUploadPicturePopup(true);
  const closeUploadPicturePopup = () => setUploadPicturePopup(false);

  // Delete picture popup state handlers
  const openDeletePicturePopup = () => setDeletePicturePopup(true);
  const closeDeletePicturePopup = () => setDeletePicturePopup(false);

  // Delete profile popup state handlers
  const openDeleteProfilePopup = () => setDeleteProfilePopup(true);
  const closeDeleteProfilePopup = () => setDeleteProfilePopup(false);

  /**
   * Handles uploading a new profile picture
   */
  const handleUploadPicture = async (file) => {
    await api.image.uploadProfileImage(file);
    closeUploadPicturePopup();
    await fetchProfile();
  };

  /**
   * Handles deleting a new profile picture
   */
  const handleDeletePicture = async () => {
    await api.image.deleteProfileImage();
    closeDeletePicturePopup();
    await fetchProfile();
  };

  /**
   * Handles deleting a new profile picture
   */
  const handleDeleteProfile = async () => {
    await api.client.deleteClientProfile();
    closeDeleteProfilePopup();
    await logout();
  };

  /**
   * Validate at least one field is provided, matching backend logic
   */
  const validateUpdateProfile = ({ username, name, surname, email }) => {
    if (
      (!username || username.trim() === '') &&
      (!name || name.trim() === '') &&
      (!surname || surname.trim() === '') &&
      (!email || email.trim() === '')
    ) {
      return 'Provide at least one field to update: Username, Name, Surname or Email.';
    }
    return undefined;
  };

  /**
   * Handles form submission for updating the profile data
   * Send only the filled fields to the API
   */
  const handleUpdateProfile = async ({ username, name, surname, email }) => {
    setIsUpdatingProfile(true);

    const payload = {};
    if (username && username.trim() !== '') payload.username = username.trim();
    if (name && name.trim() !== '') payload.name = name.trim();
    if (surname && surname.trim() !== '') payload.surname = surname.trim();
    if (email && email.trim() !== '') payload.email = email.trim();

    try {
      await api.client.updateClientProfile(payload);
      await fetchProfile(); // Refresh profile after update
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      <div className={styles.clientSettings}>
        <header className={styles.pageHeader}>
          <span className={styles.eyebrow}>Your account</span>
          <h1>Profile & security</h1>
          <p>Your verified phone keeps every booking connected to one private portal.</p>
        </header>

        <section className={styles.sessionCard}>
          <div>
            <span className={styles.sessionIcon}>
              <Icon name="dial" size="md" />
            </span>
            <div>
              <strong>{profile.phone_number}</strong>
              <span>Verified phone · persistent login enabled</span>
            </div>
          </div>
          <Button type="button" color="translight" size="md" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? <Spinner size="sm" /> : <Icon name="close" size="sm" />}
            Log out of this phone
          </Button>
        </section>

        {/* Profile Update Card */}
        <StatCard icon="pen" label="Update Profile">
          {/* Profile Picture Management */}
          <section className={styles.profileImageSection}>
            <ProfileImage src={profile.profile_image} size="15rem" />

            <div className={styles.imageAction}>
              <Button
                className={styles.actionBtn}
                type="button"
                color="gold"
                size="md"
                onClick={openUploadPicturePopup} //
              >
                <Icon name="plus" size="ty" />
                <span>Upload picture</span>
              </Button>

              <Button
                className={styles.actionBtn}
                type="button"
                color="translight"
                autoIconInvert
                size="md"
                onClick={openDeletePicturePopup} //
              >
                <Icon name="trash" size="ty" />
                <span>Delete picture</span>
              </Button>
            </div>
          </section>

          {/* Profile Updating Management  */}
          <section className={styles.updateProfileSection}>
            <Form
              className={styles.updateProfileForm}
              initialFields={{ username: '', name: '', surname: '', email: '' }}
              onSubmit={handleUpdateProfile}
              validate={validateUpdateProfile} //
            >
              <div className={styles.inputGroup}>
                <Input
                  label="Username"
                  name="username"
                  type="text"
                  placeholder={profile.username}
                  size="md"
                  disabled={isUpdatingProfile}
                />
                <div className={styles.verifiedPhone}>
                  <span>Verified phone</span>
                  <strong>{profile.phone_number}</strong>
                  <small>Phone changes require a newly verified login and support-assisted transfer.</small>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <Input
                  label="Name"
                  name="name"
                  type="text"
                  placeholder={profile.name}
                  size="md"
                  disabled={isUpdatingProfile} //
                />

                <Input
                  label="Surname"
                  name="surname"
                  type="text"
                  placeholder={profile.surname}
                  size="md"
                  disabled={isUpdatingProfile}
                />
              </div>

              <div className={styles.inputGroup}>
                <Input
                  label="Email (optional)"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={profile.email || 'you@example.com'}
                  helperText="Get an order confirmation and a one-tap link to your portal. Your phone is still how you sign in."
                  size="md"
                  disabled={isUpdatingProfile}
                />
              </div>

              <Button
                className={styles.saveBtn}
                type="submit"
                size="md"
                color="gold"
                disabled={isUpdatingProfile}
                wide //
              >
                <span className={styles.line}>
                  {isUpdatingProfile ? (
                    <>
                      <Spinner size="sm" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </span>
              </Button>

              <Error />
            </Form>
          </section>
        </StatCard>

        {/* Profile Delete Card */}
        <StatCard icon="trash" label="Delete Profile">
          {/* Profile Deletion Management */}
          <section className={styles.deleteProfileSection}>
            <Button
              className={styles.actionBtn}
              type="button"
              color="translight"
              autoIconInvert
              size="md"
              onClick={openDeleteProfilePopup} //
            >
              <Icon name="warning" size="ty" />
              <span>Delete profile</span>
            </Button>
          </section>
        </StatCard>
      </div>

      {/* Upload Picture Modal */}
      <Modal
        open={uploadPicturePopup}
        fields={{ profile_image: null }}
        action={{ submit: 'Upload', loading: 'Uploading...' }}
        onValidate={(payload) => isAnyFieldSet(payload, 'Please select an image to upload.')}
        onSubmit={({ profile_image }) => handleUploadPicture(profile_image)}
        onClose={closeUploadPicturePopup}
      >
        <Modal.Title icon="image">Upload Picture</Modal.Title>
        <Modal.Description>Select a profile image to upload.</Modal.Description>

        <Input
          label="Profile Picture"
          name="profile_image"
          type="file"
          accept="image/*"
          placeholder="Choose an image" //
        />
      </Modal>

      {/* Delete Picture Modal */}
      <Modal
        open={deletePicturePopup}
        action={{ submit: 'Delete', loading: 'Deleting...' }}
        onSubmit={handleDeletePicture}
        onClose={closeDeletePicturePopup}
      >
        <Modal.Title icon="warning">Delete Picture</Modal.Title>
        <Modal.Description>Are you sure you want to delete your profile picture? This action cannot be undone.</Modal.Description>
      </Modal>

      {/* Delete Profile Modal */}
      <Modal
        open={deleteProfilePopup}
        action={{ submit: 'Delete', loading: 'Deleting...' }}
        onSubmit={handleDeleteProfile}
        onClose={closeDeleteProfilePopup}
      >
        <Modal.Title icon="warning">Delete Profile</Modal.Title>
        <Modal.Description>Are you sure you want to delete your profile? This action cannot be undone.</Modal.Description>
      </Modal>
    </>
  );
}

export default ClientSettings;
