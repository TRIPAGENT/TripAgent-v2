import { useNavigate } from 'react-router-dom'
import { useStore } from '@/context/store'
import { Onboarding as Steps } from '@/onboarding'
import { ONBOARDING_CREDITS, ONBOARDING_IMAGES } from '@/onboarding/imageSources'
import '@/onboarding/onboarding.css'

/**
 * Three questions, asked once after the invitation: what moves them, which
 * houses they trust, and which places pull. The invitation itself has already
 * been checked by the door, so the flow starts past it.
 */
export default function Onboarding() {
  const { member, prefs, setPrefs } = useStore()
  const navigate = useNavigate()
  return (
    <Steps
      skipInvite
      memberName={member?.name?.split(/\s+/)[0]}
      initialProfile={prefs.profile}
      images={ONBOARDING_IMAGES}
      credits={ONBOARDING_CREDITS}
      hideShotBriefs
      onComplete={async (profile) => {
        setPrefs({ ...prefs, profile, completed: true })
        navigate('/', { replace: true })
      }}
    />
  )
}
