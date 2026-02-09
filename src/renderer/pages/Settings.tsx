import {Card, CardBody, Checkbox, FormControl, HStack, Text, useColorMode} from '@chakra-ui/react';
import {useContext} from 'react';
import {Page} from '../common/Page';
import {UserSettingsContext} from '../providers/UserSettingsProvider';

export const Settings = () => {
  const [userSettings, setUserSettings] = useContext(UserSettingsContext);
  const { colorMode, toggleColorMode } = useColorMode()
  return (
    <Page name={'Settings'}>
      <Card>
        <CardBody>
          <FormControl>
            <HStack gap={'15px'} alignItems={'center'} textAlign={'center'}>
              <Text>Dark Mode</Text>
              <Checkbox
                isChecked={colorMode === 'dark'}
                onChange={toggleColorMode}
              />
            </HStack>
            <Text fontSize={'xs'}>Select whether to use light or dark mode.</Text>
          </FormControl>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <FormControl>
            <HStack gap={'15px'} alignItems={'center'} textAlign={'center'}>
              <Text>Enable Fine-Grained Autoplay</Text>
              <Checkbox
                isChecked={userSettings.enableFineGrainAutoplay}
                onChange={(e) => {
                  setUserSettings({ ...userSettings, enableFineGrainAutoplay: e.target.checked });
                }}
              />
            </HStack>
            <Text fontSize={'xs'}>When enabled, you can mark certain tracks to autoplay.</Text>
          </FormControl>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <FormControl>
            <HStack gap={'15px'} alignItems={'center'} textAlign={'center'}>
              <Text>Use HTML5 Audio</Text>
              <Checkbox
                isChecked={userSettings.useHTML5Audio}
                // isDisabled={true}
                onChange={(e) => {
                  setUserSettings({ ...userSettings, useHTML5Audio: e.target.checked });
                }}
              />
            </HStack>
            <Text fontSize={'xs'}>When enabled, Howler will use HTML5 audio.  Disabled because it introduces a bug where songs restart.</Text>
          </FormControl>
        </CardBody>
      </Card>
    </Page>
  );
};
