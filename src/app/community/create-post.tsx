import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

const POST_DESTINATIONS = [
  {
    id: "all",
    name: "All Addis Football",
  },
  {
    id: "bole",
    name: "Bole Players",
  },
  {
    id: "cmc",
    name: "CMC Football",
  },
  {
    id: "beginners",
    name: "Beginners Football",
  },
];

export default function CreatePostScreen() {
  const params = useLocalSearchParams<{
    groupId?: string | string[];
  }>();

  const requestedGroupId = Array.isArray(params.groupId)
    ? params.groupId[0]
    : params.groupId;

  const initialDestination =
    requestedGroupId &&
    POST_DESTINATIONS.some((item) => item.id === requestedGroupId)
      ? requestedGroupId
      : "all";

  const [postText, setPostText] = useState("");
  const [destination, setDestination] = useState(initialDestination);
  const [destinationOpen, setDestinationOpen] = useState(false);

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    if (!postText.length) {
      return;
    }

    const keyboardTimer = setTimeout(() => {
      Keyboard.dismiss();
    }, 2000);

    return () => {
      clearTimeout(keyboardTimer);
    };
  }, [postText]);
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const selectedDestination = useMemo(
    () =>
      POST_DESTINATIONS.find((item) => item.id === destination) ??
      POST_DESTINATIONS[0],
    [destination],
  );

  const canPost = (postText.trim().length > 0 || !!selectedImage) && !posting;

  const selectedImageAspectRatio = useMemo(() => {
    if (
      !selectedImage ||
      !selectedImage.width ||
      !selectedImage.height ||
      selectedImage.width <= 0 ||
      selectedImage.height <= 0
    ) {
      return 1;
    }

    return selectedImage.width / selectedImage.height;
  }, [selectedImage]);

  async function pickPhoto() {
    if (posting) {
      return;
    }

    setPostError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow Addis Football to access your photos so you can add an image to your post.",
      );

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    setSelectedImage(result.assets[0]);

    // User has finished choosing a photo.
    // Close the keyboard so the photo/composer is fully visible.
    Keyboard.dismiss();
  }

  async function uploadPostImage(
    userId: string,
    asset: ImagePicker.ImagePickerAsset,
  ) {
    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();

    const mimeType = asset.mimeType ?? "image/jpeg";

    const rawExtension =
      asset.fileName?.split(".").pop()?.toLowerCase() ??
      mimeType.split("/").pop()?.toLowerCase() ??
      "jpg";

    const extension = rawExtension === "jpeg" ? "jpg" : rawExtension;

    const filePath = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("community-posts")
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("community-posts")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      await supabase.storage.from("community-posts").remove([filePath]);

      throw new Error("We couldn't create a public URL for your photo.");
    }

    return {
      filePath,
      publicUrl: data.publicUrl,
    };
  }

  async function handlePost() {
    Keyboard.dismiss();

    const content = postText.trim();

    if ((!content && !selectedImage) || posting) {
      return;
    }

    setPosting(true);
    setPostError(null);

    let uploadedFilePath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in to create a post.");
      }

      let imageUrl: string | null = null;

      if (selectedImage) {
        const uploadedImage = await uploadPostImage(user.id, selectedImage);

        uploadedFilePath = uploadedImage.filePath;
        imageUrl = uploadedImage.publicUrl;
      }

      const { error: insertError } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          content,
          group_id: destination === "all" ? null : destination,
          image_url: imageUrl,
        });

      if (insertError) {
        if (uploadedFilePath) {
          const { error: cleanupError } = await supabase.storage
            .from("community-posts")
            .remove([uploadedFilePath]);

          if (cleanupError) {
            console.warn(
              "Failed to clean up community post image:",
              cleanupError,
            );
          }
        }

        throw insertError;
      }

      router.back();
    } catch (error) {
      console.error("Failed to create community post:", error);

      setPostError(
        error instanceof Error
          ? error.message
          : "We couldn't publish your post. Please try again.",
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              router.back();
            }}
            disabled={posting}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={23} color={COLORS.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Create Post</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
        >
          {/* AUTHOR */}
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={23} color={COLORS.primary} />
            </View>

            <View style={styles.authorContent}>
              <Text style={styles.authorName}>You</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.destinationButton,
                  pressed && styles.pressed,
                ]}
                disabled={posting}
                onPress={() => {
                  Keyboard.dismiss();

                  setDestinationOpen((current) => !current);
                }}
              >
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={COLORS.primary}
                />

                <Text style={styles.destinationButtonText} numberOfLines={1}>
                  {selectedDestination.name}
                </Text>

                <Ionicons
                  name={destinationOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={COLORS.primary}
                />
              </Pressable>
            </View>
          </View>

          {/* DESTINATION SELECTOR */}
          {destinationOpen && (
            <View style={styles.destinationMenu}>
              <Text style={styles.destinationMenuLabel}>Post to</Text>

              {POST_DESTINATIONS.map((item, index) => {
                const selected = item.id === destination;

                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.destinationOption,
                      index < POST_DESTINATIONS.length - 1 &&
                        styles.destinationOptionBorder,
                      pressed && styles.destinationOptionPressed,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setDestination(item.id);
                      setDestinationOpen(false);
                    }}
                  >
                    <View style={styles.destinationOptionIcon}>
                      <Ionicons
                        name={
                          item.id === "all" ? "earth-outline" : "people-outline"
                        }
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>

                    <Text style={styles.destinationOptionText}>
                      {item.name}
                    </Text>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* POST TEXT */}
          <TextInput
            value={postText}
            onChangeText={(value) => {
              setPostText(value);

              if (postError) {
                setPostError(null);
              }
            }}
            placeholder="What's happening in Addis football?"
            placeholderTextColor={COLORS.textMuted}
            style={styles.postInput}
            multiline
            textAlignVertical="top"
            autoFocus
            editable={!posting}
            maxLength={1500}
          />

          {/* PHOTO PREVIEW */}
          {selectedImage && (
            <View style={styles.imagePreviewCard}>
              <Image
                source={{
                  uri: selectedImage.uri,
                }}
                style={[
                  styles.imagePreview,
                  {
                    aspectRatio: selectedImageAspectRatio,
                  },
                ]}
                resizeMode="cover"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.removeImageButton,
                  pressed && styles.removeImageButtonPressed,
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelectedImage(null);
                }}
                disabled={posting}
                accessibilityRole="button"
                accessibilityLabel="Remove selected photo"
              >
                <Ionicons name="close" size={22} color={COLORS.white} />
              </Pressable>
            </View>
          )}

          {/* CHARACTER COUNT */}
          {postText.length > 0 && (
            <View style={styles.characterRow}>
              <Text style={styles.characterCount}>{postText.length}/1500</Text>
            </View>
          )}

          {/* ERROR */}
          {postError && (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={19}
                color={COLORS.danger}
              />

              <Text style={styles.errorText}>{postError}</Text>
            </View>
          )}

          {/* ADD TO POST */}
          {!selectedImage && (
            <View style={styles.addToPostCard}>
              <Text style={styles.addToPostText}>Add to your post</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.addPhotoButton,
                  pressed && styles.addPhotoButtonPressed,
                ]}
                onPress={pickPhoto}
                disabled={posting}
                accessibilityRole="button"
                accessibilityLabel="Add photo"
              >
                <Ionicons name="images" size={25} color={COLORS.primary} />
              </Pressable>
            </View>
          )}

          {/* POST BUTTON */}
          <Pressable
            disabled={!canPost}
            style={({ pressed }) => [
              styles.postButton,
              !canPost && styles.postButtonDisabled,
              pressed && canPost && styles.postButtonPressed,
            ]}
            onPress={handlePost}
          >
            {posting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text
                style={[
                  styles.postButtonText,
                  !canPost && styles.postButtonTextDisabled,
                ]}
              >
                Post
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  keyboardView: {
    flex: 1,
  },

  pressed: {
    opacity: 0.65,
  },

  header: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    height: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: "#F7F8FA",
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    textAlign: "center",
  },

  headerSpacer: {
    width: 42,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  authorContent: {
    flex: 1,
    alignItems: "flex-start",
  },

  authorName: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },

  destinationButton: {
    maxWidth: "100%",
    height: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    marginTop: 4,
  },

  destinationButtonText: {
    flexShrink: 1,
    color: COLORS.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },

  destinationMenu: {
    marginTop: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  destinationMenuLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },

  destinationOption: {
    minHeight: 52,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  destinationOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  destinationOptionPressed: {
    backgroundColor: "#F8FAF9",
  },

  destinationOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  destinationOptionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  postInput: {
    minHeight: 64,
    maxHeight: 160,
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "500",
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 8,
  },

  imagePreviewCard: {
    position: "relative",
    width: "auto",
    marginHorizontal: -18,
    marginTop: 8,
    overflow: "hidden",
  },

  imagePreview: {
    width: "100%",
  },

  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(20, 32, 27, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },

  removeImageButtonPressed: {
    opacity: 0.75,
  },

  characterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 7,
  },

  characterCount: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },

  errorCard: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#FDECEE",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  addToPostCard: {
    minHeight: 58,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  addToPostText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },

  addPhotoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  addPhotoButtonPressed: {
    backgroundColor: COLORS.primarySoft,
  },

  postButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 18,
  },

  postButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },

  postButtonDisabled: {
    backgroundColor: COLORS.border,
  },

  postButtonText: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },

  postButtonTextDisabled: {
    color: COLORS.textMuted,
  },
});
