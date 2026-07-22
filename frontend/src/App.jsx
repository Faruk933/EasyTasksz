import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import WatchAds from "./pages/WatchAds";
import Referrals from "./pages/Referrals";
import Wallet from "./pages/Wallet";
import History from "./pages/History";
import Profile from "./pages/Profile";

import BottomNav from "./components/BottomNav";

export default function App() {
  return (
      <BrowserRouter>

            <div className="pb-20">

                    <Routes>

                              <Route path="/" element={<Dashboard />} />

                                        <Route path="/watch-ads" element={<WatchAds />} />

                                                  <Route path="/referrals" element={<Referrals />} />

                                                            <Route path="/wallet" element={<Wallet />} />

                                                                      <Route path="/history" element={<History />} />

                                                                                <Route path="/profile" element={<Profile />} />

                                                                                        </Routes>

                                                                                              </div>


                                                                                                    <BottomNav />

                                                                                                        </BrowserRouter>
                                                                                                          );
                                                                                                          }