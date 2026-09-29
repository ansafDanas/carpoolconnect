import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Input from "../components/ui/Input";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";

function Profile() {
  const { token, isDriver, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState(["passenger"]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    make: "",
    model: "",
    color: "",
    plateNumber: "",
  });
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedImages, setSelectedImages] = useState({
    profile: null,
    vehicle: null,
  });
  const [uploadingImage, setUploadingImage] = useState("");
  const [gender, setGender] = useState("undisclosed");
  const [womenOnly, setWomenOnly] = useState(false);
  const [languages, setLanguages] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get("/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const user = response.data.data;
        setProfile(user);
        setSelectedRoles(
          Array.isArray(user.roles) && user.roles.length
            ? user.roles.filter((role) => role !== "admin")
            : ["passenger"]
        );
        setGender(user.gender || "undisclosed");
        setWomenOnly(Boolean(user.womenOnly));
        setLanguages((user.languages || []).join(", "));
        const reviewsResponse = await api.get(`/reviews/user/${user._id}`);
        setReviews(reviewsResponse.data.data || []);
        setFormData({
          name: user.name || "",
          phone: user.phone || "",
          make: user.vehicleInfo?.make || "",
          model: user.vehicleInfo?.model || "",
          color: user.vehicleInfo?.color || "",
          plateNumber: user.vehicleInfo?.plateNumber || "",
        });
      } catch (requestError) {
        console.warn("Profile request failed", requestError.response?.status || "network");
        setError(
          requestError.response?.data?.message ||
            "Failed to load your profile. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const startEditing = () => {
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setFormData({
      name: profile.name || "",
      phone: profile.phone || "",
      make: profile.vehicleInfo?.make || "",
      model: profile.vehicleInfo?.model || "",
      color: profile.vehicleInfo?.color || "",
      plateNumber: profile.vehicleInfo?.plateNumber || "",
    });
    setError("");
    setEditing(false);
  };

  const toggleRole = (role) => {
    setSelectedRoles((current) => {
      const next = current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role];

      return next.length ? next : [role];
    });
  };

  const saveRoles = async () => {
    setError("");
    setSuccess("");
    setRolesLoading(true);

    try {
      const response = await api.patch(
        "/users/me/roles",
        { roles: selectedRoles },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = response.data.data;
      setProfile(updated);
      setSelectedRoles(
        Array.isArray(updated.roles) && updated.roles.length
          ? updated.roles.filter((role) => role !== "admin")
          : ["passenger"]
      );
      await refreshUser?.();
      setSuccess("Your travel modes are updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not update your travel modes."
      );
    } finally {
      setRolesLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    // Only send vehicle details when this account can actually drive,
    // otherwise the API rejects the whole update.
    const canDrive = selectedRoles.includes("driver");

    try {
      const response = await api.patch(
        "/users/me",
        {
          name: formData.name,
          phone: formData.phone,
          gender,
          womenOnly,
          languages: languages
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          ...(canDrive
            ? {
                vehicleInfo: {
                  make: formData.make,
                  model: formData.model,
                  color: formData.color,
                  plateNumber: formData.plateNumber,
                },
              }
            : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedProfile = response.data.data;
      setProfile(updatedProfile);
      setFormData({
        name: updatedProfile.name || "",
        phone: updatedProfile.phone || "",
        make: updatedProfile.vehicleInfo?.make || "",
        model: updatedProfile.vehicleInfo?.model || "",
        color: updatedProfile.vehicleInfo?.color || "",
        plateNumber: updatedProfile.vehicleInfo?.plateNumber || "",
      });
      setEditing(false);
      setSuccess("Profile updated successfully.");
    } catch (requestError) {
      console.warn("Profile update failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Failed to update your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelection = (event, imageType) => {
    setSelectedImages((current) => ({
      ...current,
      [imageType]: event.target.files[0] || null,
    }));
  };

  const uploadSelectedImage = async (imageType) => {
    const image = selectedImages[imageType];

    if (!image) {
      setError("Please select an image first.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setUploadingImage(imageType);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("image", image);
      const endpoint =
        imageType === "profile"
          ? "/users/me/profile-image"
          : "/users/me/vehicle-image";
      const response = await api.patch(endpoint, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProfile(response.data.data);
      setSelectedImages((current) => ({
        ...current,
        [imageType]: null,
      }));
      setSuccess(
        `${imageType === "profile" ? "Profile" : "Vehicle"} image uploaded successfully.`
      );
    } catch (requestError) {
      console.warn("Image upload failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Image upload failed. Please try again."
      );
    } finally {
      setUploadingImage("");
    }
  };

  const roles = profile?.roles?.length
    ? profile.roles
    : profile?.role === "driver"
      ? ["driver"]
      : ["passenger"];

  const cardClasses = "p-5 sm:p-8";
  const fieldLabel =
    "mb-1 block text-xs font-extrabold uppercase tracking-[0.1em] text-text-muted";
  const imageUploadClasses = "flex min-w-0 items-center gap-4";
  const imagePreviewClasses =
    "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted p-1 text-center text-xs text-text-muted";
  const imageContentClasses = "flex min-w-0 flex-col items-start gap-2.5";

  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Keep your personal and vehicle details up to date."
      />

      {loading && <LoadingState className="mb-6" message="Loading your profile..." />}
      {!loading && error && <Alert className="mb-6" tone="error" role="alert">{error}</Alert>}
      {!loading && success && <Alert className="mb-6" tone="success">{success}</Alert>}

      {!loading && profile && (
        <div className="grid gap-6">
          <Card className={cardClasses}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className={imageUploadClasses}>
                <div className={imagePreviewClasses}>
                  {profile.profileImage ? <img className="h-full w-full object-cover" src={profile.profileImage} alt="Profile" /> : <span>No profile image</span>}
                </div>
                <div className={imageContentClasses}>
                  <h2 className="m-0 text-lg font-extrabold text-primary">Profile image</h2>
                  <Input id="profile-image" type="file" accept="image/*" label="Choose an image" className="px-3 py-2 text-xs" onChange={(event) => handleImageSelection(event, "profile")} />
                  <Button type="button" variant="secondary" onClick={() => uploadSelectedImage("profile")} disabled={Boolean(uploadingImage)} loading={uploadingImage === "profile"}>Upload profile image</Button>
                </div>
              </div>

              {isDriver && (
                <div className={imageUploadClasses}>
                  <div className={imagePreviewClasses}>
                    {profile.vehicleInfo?.image ? <img className="h-full w-full object-cover" src={profile.vehicleInfo.image} alt="Vehicle" /> : <span>No vehicle image</span>}
                  </div>
                  <div className={imageContentClasses}>
                    <h2 className="m-0 text-lg font-extrabold text-primary">Vehicle image</h2>
                    <Input id="vehicle-image" type="file" accept="image/*" label="Choose an image" className="px-3 py-2 text-xs" onChange={(event) => handleImageSelection(event, "vehicle")} />
                    <Button type="button" variant="secondary" onClick={() => uploadSelectedImage("vehicle")} disabled={Boolean(uploadingImage)} loading={uploadingImage === "vehicle"}>Upload vehicle image</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {editing ? (
            <Card className={cardClasses}>
              <div className="mb-6 flex items-start justify-between gap-6">
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-accent">Account details</p>
                  <h2 className="m-0 text-2xl font-extrabold tracking-tight text-primary">Edit profile</h2>
                </div>
              </div>
              <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
                <Input id="profile-name" name="name" type="text" label="Name" value={formData.name} onChange={handleChange} required minLength={2} maxLength={50} />
                <Input id="profile-email" type="email" label="Email" value={profile.email || ""} disabled helperText="Email cannot be changed here." />
                <Input id="profile-phone" name="phone" type="tel" label="Phone" value={formData.phone} onChange={handleChange} />
                {selectedRoles.includes("driver") ? (
                  <>
                    <Input id="profile-make" name="make" type="text" label="Vehicle make" value={formData.make} onChange={handleChange} />
                    <Input id="profile-model" name="model" type="text" label="Vehicle model" value={formData.model} onChange={handleChange} />
                    <Input id="profile-color" name="color" type="text" label="Vehicle color" value={formData.color} onChange={handleChange} />
                    <Input id="profile-plate" name="plateNumber" type="text" label="Plate number" value={formData.plateNumber} onChange={handleChange} />
                  </>
                ) : (
                  <p className="col-span-full rounded-2xl bg-surface-muted p-4 text-sm leading-6 text-text-muted">
                    Vehicle details appear here once you switch on the driver
                    mode below. As a passenger you do not need them.
                  </p>
                )}
                <div className="col-span-full flex flex-wrap items-center gap-3.5 pt-1.5">
                  <Button type="submit" loading={saving}>Save changes</Button>
                  <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>Cancel</Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card className={cardClasses}>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-accent">Personal details</p>
                  <h2 className="m-0 break-words text-2xl font-extrabold tracking-tight text-primary">{profile.name}</h2>
                </div>
                <Button type="button" variant="secondary" onClick={startEditing}>Edit profile</Button>
              </div>
              <div className="grid grid-cols-1 gap-6 border-t border-border pt-6 sm:grid-cols-2">
                <div className="min-w-0"><span className={fieldLabel}>Email</span><strong className="block break-words text-base font-bold text-primary">{profile.email}</strong></div>
                <div className="min-w-0"><span className={fieldLabel}>Phone</span><strong className="block break-words text-base font-bold text-primary">{profile.phone || "Not provided"}</strong></div>
                <div className="min-w-0"><span className={fieldLabel}>Roles</span><div className="flex flex-wrap gap-2">{roles.map((role) => <Badge key={role} tone={role}>{role}</Badge>)}</div></div>
                <div className="min-w-0"><span className={fieldLabel}>Rating</span><strong className="block break-words text-base font-bold text-primary">{profile.rating ?? "Not rated"}</strong></div>
                {selectedRoles.includes("driver") && (
                  <>
                    <div className="min-w-0"><span className={fieldLabel}>Vehicle</span><strong className="block break-words text-base font-bold text-primary">{profile.vehicleInfo?.make || profile.vehicleInfo?.model ? `${profile.vehicleInfo.make || ""} ${profile.vehicleInfo.model || ""}`.trim() : "Not provided"}</strong></div>
                    <div className="min-w-0"><span className={fieldLabel}>Color / plate</span><strong className="block break-words text-base font-bold text-primary">{profile.vehicleInfo?.color || profile.vehicleInfo?.plateNumber ? `${profile.vehicleInfo.color || ""}${profile.vehicleInfo.color && profile.vehicleInfo.plateNumber ? " / " : ""}${profile.vehicleInfo.plateNumber || ""}` : "Not provided"}</strong></div>
                  </>
                )}
              </div>
            </Card>
          )}

          <Card className={cardClasses}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-violet">Same account, both sides</p>
                <h2 className="m-0 text-2xl font-extrabold tracking-tight text-primary">How you travel</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-text-muted">
                  Drive to work in the morning and need a ride home? Turn on
                  both modes. Vehicle details are only asked for when you
                  actually drive.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: "passenger", title: "I need rides", hint: "Post requests and book seats" },
                { value: "driver", title: "I offer rides", hint: "Share seats on your route" },
              ].map((option) => {
                const selected = selectedRoles.includes(option.value);

                return (
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-white hover:border-primary/25"
                    }`}
                    key={option.value}
                  >
                    <input
                      checked={selected}
                      className="h-4 w-4 accent-[#FF5C7A]"
                      onChange={() => toggleRole(option.value)}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-extrabold text-primary">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={saveRoles} loading={rolesLoading}>
                Save travel modes
              </Button>
              <span className="text-xs font-semibold text-text-muted">
                Changes apply immediately across the app.
              </span>
            </div>
          </Card>

          <Card className={cardClasses}>
            <div className="mb-5">
              <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-leaf">Safety & preferences</p>
              <h2 className="m-0 text-2xl font-extrabold tracking-tight text-primary">Who you travel with</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-text-muted">
                This is how matching decides who you see. We never share it
                publicly and you can change it any time.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Gender</span>
                <select
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-leaf"
                  onChange={(event) => setGender(event.target.value)}
                  value={gender}
                >
                  <option value="undisclosed">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Languages</span>
                <input
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-leaf"
                  onChange={(event) => setLanguages(event.target.value)}
                  placeholder="Malayalam, English, Hindi"
                  value={languages}
                />
              </label>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-muted p-4">
              <input
                checked={womenOnly}
                className="mt-1 h-4 w-4 accent-[#2E7D62]"
                onChange={(event) => setWomenOnly(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-extrabold text-primary">
                  Women only, please
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                  You will only ever be matched with other women. Takes effect
                  once you save.
                </span>
              </span>
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving} onClick={handleSubmit}>
                Save preferences
              </Button>
              <span className="text-xs font-semibold text-text-muted">
                Applies to every match from now on.
              </span>
            </div>
          </Card>

          <Card className={cardClasses}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-accent">Community feedback</p>
                <h2 className="m-0 text-2xl font-extrabold tracking-tight text-primary">Reviews</h2>
              </div>
              <Badge tone="info">{reviews.length}</Badge>
            </div>
            {reviews.length === 0 ? (
              <EmptyState title="No reviews received yet." />
            ) : (
              <div className="grid gap-2.5">
                {reviews.map((review) => (
                  <article className="rounded-xl border border-border bg-surface-muted p-4" key={review._id}>
                    <div className="flex items-center justify-between gap-3 text-sm text-primary">
                      <strong>{review.reviewer?.name || "Passenger"}</strong>
                      <span className="whitespace-nowrap tracking-[0.08em] text-accent" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                    </div>
                    {review.comment && <p className="mt-2 text-sm text-text-muted">{review.comment}</p>}
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Link
        className="mt-6 inline-flex items-center text-sm font-bold text-accent no-underline transition hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        to="/app/dashboard"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}

export default Profile;
