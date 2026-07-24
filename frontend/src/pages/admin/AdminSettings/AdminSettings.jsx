import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { isAnyFieldSet } from '@utils/utils';
import styles from './AdminSettings.module.scss';
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

function AdminSettings() {
  const { profile, setProfile, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [shop, setShop] = useState(null);
  const [portfolio, setPortfolio] = useState([]);

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false); // Used to disable the update profile button

  // Popup states
  const [uploadPicturePopup, setUploadPicturePopup] = useState(false);
  const [deletePicturePopup, setDeletePicturePopup] = useState(false);
  const [deleteProfilePopup, setDeleteProfilePopup] = useState(false);
  const [createPortfolioPopup, setCreatePortfolioPopup] = useState(false);
  const [deletePortfolioPopup, setDeletePortfolioPopup] = useState({ open: false, item: null });

  /**
   * Defines fetching latest profile data
   */
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      const { profile } = await api.admin.getAdminProfile();
      setProfile(profile);
    } finally {
      setIsLoading(false);
    }
  }, [setProfile]);

  const fetchBusiness = useCallback(async () => {
    setIsLoadingBusiness(true);
    try {
      const [{ shop }, { portfolio }] = await Promise.all([api.business.getShopSettings(), api.business.getPortfolio()]);
      setShop(shop);
      setPortfolio(portfolio);
    } finally {
      setIsLoadingBusiness(false);
    }
  }, []);

  /**
   *  Fetches on mount to keep profile data always up to date
   */
  useEffect(() => {
    fetchProfile();
    fetchBusiness();
  }, [fetchProfile, fetchBusiness]);

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
  const closeCreatePortfolioPopup = () => setCreatePortfolioPopup(false);
  const closeDeletePortfolioPopup = () => setDeletePortfolioPopup({ open: false, item: null });

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
    await api.admin.deleteAdminProfile();
    closeDeleteProfilePopup();
    await logout();
  };

  /**
   * Validate at least one field is provided, matching backend logic
   */
  const validateUpdateProfile = ({ username }) => {
    if (!username || username.trim() === '') {
      return 'Provide at least one field to update: Username.';
    }
    return undefined;
  };

  /**
   * Handles form submission for updating the profile data
   * Send only the filled fields to the API
   */
  const handleUpdateProfile = async ({ username }) => {
    setIsUpdatingProfile(true);

    const payload = {};
    if (username && username.trim() !== '') payload.username = username.trim();

    try {
      await api.admin.updateAdminProfile(payload);
      await fetchProfile(); // Refresh profile after update
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateShop = async (fields) => {
    setIsSavingShop(true);
    try {
      const { opening_hours_weekdays, opening_hours_saturday, opening_hours_sunday, ...shopFields } = fields;
      const openingHours = {};
      if (opening_hours_weekdays?.trim()) openingHours['Mon–Fri'] = opening_hours_weekdays.trim();
      if (opening_hours_saturday?.trim()) openingHours.Saturday = opening_hours_saturday.trim();
      if (opening_hours_sunday?.trim()) openingHours.Sunday = opening_hours_sunday.trim();
      const payload = {
        ...shopFields,
        opening_hours: openingHours,
        announcement_enabled: fields.announcement_enabled === 'true' || fields.announcement_enabled === true,
        home_visits_enabled: fields.home_visits_enabled === 'true' || fields.home_visits_enabled === true,
        home_visit_fee: Number(fields.home_visit_fee || 0),
        service_radius_km: Number(fields.service_radius_km || 0),
        booking_horizon_days: Number(fields.booking_horizon_days || 60),
        cancellation_notice_hours: Number(fields.cancellation_notice_hours || 0),
        reminder_minutes: Number(fields.reminder_minutes || 90),
      };
      const { shop: updatedShop } = await api.business.updateShopSettings(payload);
      setShop(updatedShop);
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleCreatePortfolioItem = async (fields) => {
    await api.business.createPortfolioItem({ ...fields, featured: true, active: true });
    closeCreatePortfolioPopup();
    await fetchBusiness();
  };

  const handleDeletePortfolioItem = async (itemId) => {
    await api.business.deletePortfolioItem(itemId);
    closeDeletePortfolioPopup();
    await fetchBusiness();
  };

  return (
    <>
      <div className={styles.adminSettings}>
        <StatCard icon="scissors" label="Shop & booking">
          {isLoadingBusiness || !shop ? (
            <div className={styles.loadingBlock}>
              <Spinner />
            </div>
          ) : (
            <Form
              key={JSON.stringify(shop)}
              className={styles.businessForm}
              initialFields={{
                ...shop,
                announcement_enabled: String(shop.announcement_enabled),
                home_visits_enabled: String(shop.home_visits_enabled),
                opening_hours_weekdays: shop.opening_hours?.['Mon–Fri'] || '',
                opening_hours_saturday: shop.opening_hours?.Saturday || '',
                opening_hours_sunday: shop.opening_hours?.Sunday || '',
              }}
              onSubmit={handleUpdateShop}
            >
              <div className={styles.formIntro}>
                <div>
                  <h2>Public business details</h2>
                  <p>These details appear on the landing page and control the client booking rules.</p>
                </div>
                <Button type="submit" color="gold" size="md" disabled={isSavingShop}>
                  {isSavingShop ? <Spinner size="sm" /> : <Icon name="check" size="ty" />}
                  {isSavingShop ? 'Saving…' : 'Save shop settings'}
                </Button>
              </div>

              <div className={styles.businessGrid}>
                <Input label="Shop name" name="name" type="text" required size="md" />
                <Input label="Tagline" name="tagline" type="text" required maxLength={180} size="md" />
                <Input label="Description" name="description" type="text" maxLength={500} size="md" />
                <Input
                  label="Promotional announcement"
                  name="announcement_text"
                  type="text"
                  maxLength={180}
                  placeholder="This week: complimentary beard detail with selected cuts"
                  size="md"
                />
                <Input
                  label="Show promotion"
                  name="announcement_enabled"
                  type="dropdown"
                  size="md"
                  fetcher={async () => [
                    { key: 'true', value: 'Visible on public site' },
                    { key: 'false', value: 'Hidden' },
                  ]}
                />
                <Input label="Address" name="address" type="text" size="md" />
                <Input label="Phone" name="phone_number" type="tel" inputMode="tel" size="md" />
                <Input label="WhatsApp" name="whatsapp_number" type="tel" inputMode="tel" size="md" />
                <Input label="Public email" name="email" type="email" size="md" />
                <Input label="Google Maps URL" name="maps_url" type="url" size="md" />
                <Input label="Instagram URL" name="instagram_url" type="url" size="md" />
                <Input label="Currency symbol" name="currency_symbol" type="text" maxLength={8} size="md" />
                <Input
                  label="Monday–Friday hours"
                  name="opening_hours_weekdays"
                  type="text"
                  placeholder="9:00 AM – 7:00 PM"
                  size="md"
                />
                <Input
                  label="Saturday hours"
                  name="opening_hours_saturday"
                  type="text"
                  placeholder="9:00 AM – 7:00 PM"
                  size="md"
                />
                <Input label="Sunday hours" name="opening_hours_sunday" type="text" placeholder="Closed" size="md" />
                <Input
                  label="Home visits"
                  name="home_visits_enabled"
                  type="dropdown"
                  size="md"
                  fetcher={async () => [
                    { key: 'true', value: 'Enabled' },
                    { key: 'false', value: 'Disabled' },
                  ]}
                />
                <Input label="Home-visit fee" name="home_visit_fee" type="number" min="0" step="0.01" size="md" />
                <Input label="Service radius (km)" name="service_radius_km" type="number" min="1" size="md" />
                <Input label="Book ahead (days)" name="booking_horizon_days" type="number" min="1" size="md" />
                <Input label="Cancellation notice (hours)" name="cancellation_notice_hours" type="number" min="0" size="md" />
                <Input label="Reminder before (minutes)" name="reminder_minutes" type="number" min="15" size="md" />
              </div>
              <Error />
            </Form>
          )}
        </StatCard>

        <StatCard icon="image" label="Featured cuts">
          <section className={styles.portfolioSection}>
            <div className={styles.formIntro}>
              <div>
                <h2>Landing-page gallery</h2>
                <p>Show real finished work with a clear name, duration, and starting price.</p>
              </div>
              <Button type="button" color="gold" size="md" onClick={() => setCreatePortfolioPopup(true)}>
                <Icon name="plus" size="ty" /> Add featured cut
              </Button>
            </div>

            {isLoadingBusiness ? (
              <div className={styles.loadingBlock}>
                <Spinner />
              </div>
            ) : portfolio.length ? (
              <div className={styles.portfolioGrid}>
                {portfolio.map((item) => (
                  <article className={styles.portfolioItem} key={item.id}>
                    <img src={item.image} alt={item.title} />
                    <div className={styles.portfolioCopy}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.duration_minutes} min · {shop?.currency_symbol || 'GH₵'} {item.price}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      color="actionbtn"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => setDeletePortfolioPopup({ open: true, item })}
                    >
                      <Icon name="trash" size="ty" />
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>
                No uploaded cuts yet. The curated starter images remain visible until you add your own.
              </p>
            )}
          </section>
        </StatCard>

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
              initialFields={{ username: '' }}
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
        open={createPortfolioPopup}
        fields={{ image: null, title: '', description: '', duration_minutes: 45, price: '', display_order: 0 }}
        action={{ submit: 'Add to gallery', loading: 'Uploading...' }}
        onValidate={({ image, title }) => (!image || !title.trim() ? 'Choose an image and provide a title.' : undefined)}
        onSubmit={handleCreatePortfolioItem}
        onClose={closeCreatePortfolioPopup}
      >
        <Modal.Title icon="image">Add Featured Cut</Modal.Title>
        <Modal.Description>Use a sharp portrait or finished-cut image with consistent lighting.</Modal.Description>
        <Input label="Image" name="image" type="file" accept="image/*" placeholder="Choose a photo" />
        <Input label="Cut name" name="title" type="text" required maxLength={100} size="md" />
        <Input label="Short description" name="description" type="text" maxLength={240} size="md" />
        <Input label="Duration (minutes)" name="duration_minutes" type="number" min="10" max="480" required size="md" />
        <Input label="Starting price" name="price" type="number" min="0" step="0.01" required size="md" />
        <Input label="Display order" name="display_order" type="number" min="0" size="md" />
      </Modal>

      <Modal
        open={deletePortfolioPopup.open}
        action={{ submit: 'Remove', loading: 'Removing...' }}
        onSubmit={() => handleDeletePortfolioItem(deletePortfolioPopup.item?.id)}
        onClose={closeDeletePortfolioPopup}
      >
        <Modal.Title icon="warning">Remove Featured Cut</Modal.Title>
        <Modal.Description>
          Remove <strong>{deletePortfolioPopup.item?.title}</strong> from the landing-page gallery?
        </Modal.Description>
      </Modal>

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

export default AdminSettings;
