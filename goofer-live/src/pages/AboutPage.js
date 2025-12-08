import React from 'react';
import { Twitch, Youtube, Twitter } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';
import SocialButton from '../components/SocialButton';

export default function AboutPage() {
  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              ABOUT ME
            </span>
          </h1>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-emerald-400">
              WHO AM I?
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-4">
              Just a chill Brazilian streamer bringing good vibes and energy to
              the internet. I stream a mix of gaming with friends, going through
              story games or competitively, some gamba sessions for the thrill,
              and react content where we watch and discuss whatever's trending.
            </p>
            <p className="text-lg text-white/80 leading-relaxed">
              When I'm not streaming, I'm probably gaming anyway, vibing to
              music, or just enjoying life. The stream is all about having fun,
              staying positive, and building a community of like-minded people.
            </p>
          </div>

          <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-purple-400">
              WHAT I STREAM
            </h2>
            <div className="space-y-4">
              <ContentItem
                title="Gaming"
                description="Single Player games like Yakuza, Nioh and Satisfactory, Arc Raiders, and whatever else catches my attention. Always trying to improve and have fun doing it. I also love simulation and management games!"
              />
              <ContentItem
                title="Gamba"
                description="High stakes slot sessions and casino games. Remember: it's entertainment, not financial advice! 🎰"
              />
              <ContentItem
                title="React & Just Chatting"
                description="Reddit threads, YouTube videos, and just hanging with chat. Most chill part of the stream."
              />
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-emerald-400">
              COMMUNITY VIBES
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-4">
              The stream is a judgment-free zone. We're here to have fun,
              support each other, and share good energy. Toxicity isn't welcome
              - just good vibes and good times. And remember...Don't be a cunt.
            </p>
            <p className="text-lg text-white/80 leading-relaxed">
              Weed friendly, 420 positive, and always keeping it real. Come
              hang, chat, lurk, whatever works for you. Everyone's welcome in
              the community. 💚💜
            </p>
          </div>

          <div className="text-center pt-8">
            <h3 className="text-2xl font-bold mb-6 text-white/60">
              CONNECT WITH ME
            </h3>
            <div className="flex gap-4 justify-center">
              <SocialButton
                icon={<Twitch size={20} />}
                label="Twitch"
                color="purple"
                href={SOCIAL_LINKS.twitch}
              />
              <SocialButton
                icon={<Youtube size={20} />}
                label="YouTube"
                color="red"
                href={SOCIAL_LINKS.youtube}
              />
              <SocialButton
                icon={<Twitter size={20} />}
                label="Twitter"
                color="blue"
                href={SOCIAL_LINKS.twitter}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentItem({ title, description }) {
  return (
    <div className="border-l-4 border-emerald-500/50 pl-4">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-white/70">{description}</p>
    </div>
  );
}
