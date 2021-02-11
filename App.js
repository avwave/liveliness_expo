import { Camera } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Permissions from "expo-permissions";
import * as ScreenOrientation from "expo-screen-orientation";
import * as FaceDetector from "expo-face-detector";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const API_KEY = "AIzaSyDW0n19z3kngkKifTnI2XEa3jRzL6cHgqY";
const API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

const LIVELY_API_URL = `https://iva89zjxsi.execute-api.us-east-1.amazonaws.com/Prod/challenge/`;

const LIVELY_API_START_ENDPOINT = "start";
const LIVELY_API_FRAMES_ENDPOINT_PATTERN = `frames`;
const LIVELY_API_VERIFY_ENDPOINT_PATTERN = `verify`;

const { width: winWidth, height: winHeight } = Dimensions.get("window");

async function callGoogleVisionAsync(image) {
  const body = {
    requests: [
      {
        image: {
          content: image,
        },
        features: [
          {
            type: "FACE_DETECTION",
            maxResults: 1,
          },
        ],
      },
    ],
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();

  console.log("Result:", parsed);

  return parsed.responses[0].labelAnnotations[0].description;
}

let liveliness = [
  { step: "smile", success: false },
  { step: "left", success: false },
  { step: "right", success: false },
  { step: "ahead", success: false },
];


export default function App() {
  const cameraRef = useRef(null)

  const [cameraType, setCameraType] = useState(Camera.Constants.Type.front);
  const [isCapture, setIsCapture] = useState(false);
  const [isPermissionsGranted] = Permissions.usePermissions(
    Permissions.CAMERA,
    { ask: true }
  );

  const [faceYaw, setFaceYaw] = useState(0);
  const [smileProb, setSmileProb] = useState(0);
  const [currentFace, setCurrentFace] = useState(0);

  const [currentStep, setCurrentStep] = useState(0);
  const [isLively, setIsLively] = useState(false);

  const [photo, setPhoto] = useState(false);

  useEffect(() => {
    async function setOrientation() {
      const orient = await ScreenOrientation.lockAsync(
        ScreenOrientation.Orientation.PORTRAIT_UP
      );
      console.log(
        "🚀 ~ file: App.js ~ line 60 ~ setOrientation ~ orient",
        orient
      );
    }
    setOrientation();
  }, []);

  if (!isPermissionsGranted) {
    return (
      <View style={styles.container}>
        <Text>
          You have not granted permission to use the camera on this device!
        </Text>
      </View>
    );
  }


  const onPictureSaved = (photo) => {
    setPhoto(photo);
  }
  const takePhoto = async () => {
    await cameraRef.current.takePictureAsync({onPictureSaved: onPictureSaved})
  }

  const handleFaceDetected = async ({ faces }) => {
    const cStep = currentStep
    const face = faces.length ? faces[0] : false;
    if (!isCapture) {
      return
    }
    if (!face) {
      return;
    }

    const lively = liveliness.every(lStep => lStep.success === true)
    setIsLively(lively)
    if (lively) {
      setIsCapture(false)
      await takePhoto()
      return
    }
    
    setFaceYaw(face.yawAngle);
    setCurrentFace(face.faceID);
    setSmileProb(face.smilingProbability);

    let successStep = false
    switch (liveliness[cStep].step) {
      case 'smile':
        if (face.smilingProbability > 0.5) {
          successStep = true;
        }
        break;
      default:
        if (challengeDirection(face.yawAngle) === liveliness[cStep].step) {
          successStep = true;
        }
        break;
    }

    if (successStep) {
      liveliness[cStep].success = true
      if (cStep+1 < liveliness.length) {
        setCurrentStep(cStep+1)
      }
    }

  };

  const startCapture = () => {
    setIsCapture(true);
  };

  const challengeDirection = (yaw) => {
    if (yaw > 10 && yaw < 45) {
      return "right";
    } else if (yaw > 315 && yaw < 350) {
      return "left";
    } else if (yaw > 315 || yaw < 10) {
      return "ahead";
    } else {
      return "INVALID DIRECTION";
    }
  };

  console.log("🚀 ~ file: App.js ~ line 237 ~ App ~ photo", photo);
  return (
    <View style={styles.container}>
      {photo ? (
        <Image
          source={{ uri: photo.uri }}
          style={{ width: winWidth, height: winWidth }}
        />
      ) : (
        <Camera
          ref={cameraRef}
          videoStabilizationMode={Camera.Constants.VideoStabilization.cinematic}
          ratio="1:1"
          style={styles.camera}
          type={cameraType}
          onFacesDetected={handleFaceDetected}
          faceDetectorSettings={{
            mode: FaceDetector.Constants.Mode.fast,
            detectLandmarks: FaceDetector.Constants.Landmarks.none,
            runClassifications: FaceDetector.Constants.Classifications.all,
            minDetectionInterval: 1500,
            tracking: true,
          }}
        >
          <View style={styles.promptContainer}>
            <View style={styles.prompts}>
              {isCapture ? (
                <Text style={styles.textPrompt}>
                  {liveliness[currentStep].step}
                </Text>
              ) : (
                <Button onPress={startCapture} title="Start Capture" />
              )}
            </View>
          </View>
        </Camera>
      )}
      <View>
        <Text>faceID: {currentFace}</Text>
        <Text>yaw: {faceYaw}</Text>
        <Text>facing: {challengeDirection(faceYaw)}</Text>
        <Text>smile: {smileProb}</Text>
        <Text>smiling: {smileProb > 0.5 ? "Yes" : "No"}</Text>
      </View>
      <View>
        <Text>---</Text>
        {liveliness.map((lStep) => (
          <Text key={lStep.step}>
            step {lStep.step}:{lStep.success ? "True" : "False"}
          </Text>
        ))}
        {isLively ? <Text>MOCK: Sending image to rekognition</Text> : <></>}
      </View>
    </View>
  );
}
  

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    aspectRatio: 1,
    width: winWidth,
    height: winWidth,
    position: "relative",
  },
  promptContainer: {
    flex: 1,
    position: "absolute",
    bottom: 0,
  },
  prompts: {
    backgroundColor: "transparent",
    flexDirection: "column",
    alignSelf: "flex-end",
    alignItems: "center",
  },
  image: {
    width: 300,
    height: 300,
  },
  textPrompt: {
    fontSize: 40,
    textAlign:'center',
    color: "white",
  },
});
