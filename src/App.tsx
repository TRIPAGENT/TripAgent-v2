import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactElement } from 'react'
import { useStore } from '@/context/store'
import SignIn from '@/screens/SignIn'
import RequestAccess from '@/screens/RequestAccess'
import Onboarding from '@/screens/Onboarding'
import Discover from '@/screens/Discover'
import City from '@/screens/City'
import DestinationSearch from '@/screens/DestinationFallback'
import Month from '@/screens/Month'
/*
 * The two map screens are split out of the main bundle. Between them they carry
 * the world's country outlines (~750 kB raw) and the Google Maps loader, which
 * every member would otherwise download to open the front door. They arrive
 * when a map is actually opened.
 */
const ItineraryPreview = lazy(() => import('@/preview/ItineraryPreview'))
const CityMapScreen = lazy(() => import('@/screens/CityMap'))
const WorldMapScreen = lazy(() => import('@/screens/WorldMapScreen'))
import Saved from '@/screens/Saved'
import Journeys from '@/screens/Journeys'
import Itinerary from '@/screens/ItineraryScreen'
import Concierge from '@/screens/Concierge'
import BookingRequest from '@/screens/BookingRequest'
import Status from '@/screens/Status'
import Quote from '@/screens/Quote'
import Desk from '@/screens/Desk'
import Membership from '@/screens/Membership'
import Services from '@/screens/Services'
import ServiceHotels from '@/screens/ServiceHotels'
import ServiceEnquiry from '@/screens/ServiceEnquiry'
import Handover from '@/screens/Handover'
import Legal from '@/screens/Legal'

function RequireMember({ children }: { children: ReactElement }) {
  const { member } = useStore()
  const location = useLocation()
  if (!member) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  return children
}

/**
 * The rooms, in the member's language: Discover, Journeys, Tara,
 * Saved, Membership. The routes the app used before (wishlist, planner,
 * account, advisor) redirect, so an old link or a saved shortcut still lands.
 */
export default function App() {
  const { member } = useStore()

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--ink-0)' }} />}>
    <Routes>
      <Route path="/signin" element={member ? <Navigate to="/" replace /> : <SignIn />} />
      <Route path="/request-access" element={member ? <Navigate to="/" replace /> : <RequestAccess />} />
      <Route
        path="/onboarding"
        element={
          <RequireMember>
            <Onboarding />
          </RequireMember>
        }
      />
      {(
        [
          ['/', <Discover key="d" />],
          ['/destinations', <DestinationSearch key="ds" />],
          ['/city/:slug', <City key="c" />],
          ['/month/:no', <Month key="m" />],
          ['/city/:slug/map', <CityMapScreen key="cm" />],
          ['/map', <WorldMapScreen key="wm" />],
          ['/saved', <Saved key="sv" />],
          ['/preview/itinerary', <ItineraryPreview key="preview" />],
          ['/journeys', <Journeys key="j" />],
          ['/journeys/:key', <Itinerary key="it" />],
          ['/concierge', <Concierge key="co" />],
          ['/booking-request', <BookingRequest key="b" />],
          ['/status', <Status key="s" />],
          ['/settlement', <Quote key="q" />],
          ['/desk', <Desk key="dk" />],
          ['/membership', <Membership key="me" />],
          ['/services', <Services key="se" />],
          ['/services/hotels', <ServiceHotels key="sh" />],
          ['/services/:kind', <ServiceEnquiry key="sq" />],
          ['/handover', <Handover key="ho" />],
        ] as [string, ReactElement][]
      ).map(([path, element]) => (
        <Route key={path} path={path} element={<RequireMember>{element}</RequireMember>} />
      ))}

      {/* The rooms were renamed in the redesign; the old addresses still lead there. */}
      <Route path="/wishlist" element={<Navigate to="/saved" replace />} />
      <Route path="/planner" element={<Navigate to="/journeys" replace />} />
      <Route path="/account" element={<Navigate to="/membership" replace />} />
      <Route path="/advisor" element={<Navigate to="/desk" replace />} />

      {/* The terms are readable before signing in: a member should see them before the door. */}
      <Route path="/legal/:slug" element={<Legal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
