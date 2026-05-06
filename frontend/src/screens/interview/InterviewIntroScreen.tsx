import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AuthContext } from '../../context/AuthContext';
import { analyzeReferenceFromUri, ReferenceProfile } from '../../ai_modules/video_ai/webIdentity';

export const InterviewIntroScreen: React.FC<any> = ({ navigation, route }) => {
  const { jobId } = route.params || {};
  const { profile } = useContext(AuthContext);
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null);
  const [referenceProfile, setReferenceProfile] = useState<ReferenceProfile | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const instructions = [
    {
      icon: 'camera',
      title: 'Upload a Selfie',
      desc: 'Take or upload a clear photo of your face for identity verification.',
      color: '#8b5cf6',
    },
    {
      icon: 'videocam',
      title: 'Stay Visible',
      desc: 'Ensure your face is clearly visible in the camera frame.',
      color: theme.colors.primary,
    },
    {
      icon: 'mic',
      title: 'Speak Clearly',
      desc: 'Talk at a steady pace and normal volume.',
      color: theme.colors.secondary,
    },
    {
      icon: 'volume-mute',
      title: 'Quiet Environment',
      desc: 'Find a place with minimal background noise.',
      color: theme.colors.accent,
    },
  ];

  const analyzePhoto = async (uri: string) => {
    setReferencePhoto(uri);
    setReferenceProfile(null);
    setAnalysisError(null);

    // On web, run face-api.js analysis to create a ReferenceProfile
    if (Platform.OS === 'web') {
      setAnalyzing(true);
      try {
        const profile = await analyzeReferenceFromUri(uri);
        setReferenceProfile(profile);
      } catch (err: any) {
        setAnalysisError(err.message || 'Face analysis failed');
        setReferencePhoto(null);
        Alert.alert('Face Analysis Failed', err.message || 'Could not analyze the photo. Please try a different one.');
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const pickImage = async () => {
    try {
      // Ask for permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'We need access to your photo library to upload a reference photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await analyzePhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image pick error:', err);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'We need camera access to take a selfie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled && result.assets[0]) {
        await analyzePhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppButton
          variant="ghost"
          title=""
          icon={<Ionicons name="chevron-back" size={24} color={theme.colors.text} />}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        />
        <Text style={styles.headerTitle}>Interview Prep</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Reference Photo Section */}
        <AppCard style={styles.photoCard} variant="outlined">
          <View style={styles.photoSection}>
            <View style={styles.photoSectionHeader}>
              <View style={[styles.stepBadge, { backgroundColor: '#8b5cf6' }]}>
                <Text style={styles.stepBadgeText}>STEP 1</Text>
              </View>
              <Text style={styles.photoTitle}>Identity Verification</Text>
              <Text style={styles.photoSubtitle}>
                Upload a clear selfie. This will be used to verify your identity throughout the interview.
              </Text>
            </View>

            {referencePhoto ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: referencePhoto }} style={styles.photoPreview} />
                {analyzing ? (
                  <View style={styles.photoVerified}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[styles.photoVerifiedText, { color: theme.colors.primary }]}>Analyzing face...</Text>
                  </View>
                ) : referenceProfile ? (
                  <View style={styles.photoVerified}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.photoVerifiedText}>Face verified ✓</Text>
                  </View>
                ) : Platform.OS !== 'web' ? (
                  <View style={styles.photoVerified}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.photoVerifiedText}>Photo uploaded</Text>
                  </View>
                ) : null}
                <TouchableOpacity onPress={() => { setReferencePhoto(null); setReferenceProfile(null); setAnalysisError(null); }} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoOptionBtn} onPress={takePhoto}>
                  <View style={[styles.photoOptionIcon, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="camera" size={28} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.photoOptionLabel}>Take Selfie</Text>
                </TouchableOpacity>

                <View style={styles.dividerVertical} />

                <TouchableOpacity style={styles.photoOptionBtn} onPress={pickImage}>
                  <View style={[styles.photoOptionIcon, { backgroundColor: '#f5f3ff' }]}>
                    <Ionicons name="images" size={28} color="#8b5cf6" />
                  </View>
                  <Text style={styles.photoOptionLabel}>From Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </AppCard>

        {/* Instructions */}
        <View style={styles.instructionsHeader}>
          <View style={[styles.stepBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.stepBadgeText}>STEP 2</Text>
          </View>
          <Text style={styles.title}>Get Ready</Text>
          <Text style={styles.subtitle}>
            Follow these simple steps for the best AI interview experience.
          </Text>
        </View>

        <View style={styles.instructionsContainer}>
          {instructions.map((item, index) => (
            <AppCard key={index} style={styles.instructionCard} variant="outlined">
              <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>{item.title}</Text>
                <Text style={styles.instructionDesc}>{item.desc}</Text>
              </View>
            </AppCard>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          title={analyzing ? "Analyzing Face..." : referencePhoto ? "Begin Interview" : "Upload Photo First"}
          onPress={() => {
            if (!referencePhoto) {
              Alert.alert('Photo Required', 'Please upload or take a reference photo before starting the interview.');
              return;
            }
            if (Platform.OS === 'web' && !referenceProfile) {
              Alert.alert('Analysis Required', 'Please wait for face analysis to complete, or try uploading a different photo.');
              return;
            }
            navigation.navigate('Interview', { 
              jobId, 
              referencePhoto,
              referenceProfile: referenceProfile || undefined,
              candidateName: profile?.full_name ?? 'Candidate',
              trade: profile?.trade ?? 'General',
              phoneNumber: profile?.phone ?? '',
            });
          }}
          style={styles.beginBtn}
          disabled={!referencePhoto || analyzing}
          icon={referencePhoto && !analyzing ? <Ionicons name="arrow-forward" size={20} color="#fff" /> : undefined}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: 56,
  },
  backBtn: {
    width: 40,
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },

  // Photo upload card
  photoCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 32,
  },
  photoSection: {
    padding: 20,
  },
  photoSectionHeader: {
    marginBottom: 20,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  stepBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  photoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  photoSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  // Photo actions (take/pick)
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  photoOptionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  photoOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  photoOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dividerVertical: {
    width: 1,
    height: 60,
    backgroundColor: theme.colors.border,
  },

  // Photo preview
  photoPreviewContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#22c55e',
    marginBottom: 12,
  },
  photoVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  photoVerifiedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  changePhotoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changePhotoText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },

  // Instructions
  instructionsHeader: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  instructionsContainer: {
    width: '100%',
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  instructionDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: theme.spacing.lg,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  beginBtn: {
    width: '100%',
  },
});
