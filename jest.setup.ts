/**
 * Jest mock for AsyncStorage so unit tests never touch the native module.
 */
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock'

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage)
